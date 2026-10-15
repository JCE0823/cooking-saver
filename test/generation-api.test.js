import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../server/app.js";
import { migrateDatabase } from "../server/db.js";
import { createRecipeRepository } from "../server/recipe-repository.js";
import { createTestPool } from "./postgres.js";

const validRecipe = {
  name: "Lentil Stew",
  prepMinutes: 15,
  cookMinutes: 35,
  servings: 4,
  notes: "Serve with crusty bread.",
  source: "ai",
  ingredients: [{ quantity: "1 cup", name: "brown lentils" }],
  instructions: ["Simmer the lentils until tender."]
};
const auth = { username: "student", password: "correct horse battery staple" };

let pool;

afterEach(async () => {
  await pool?.end();
});

async function createTestApp(options = {}) {
  pool = createTestPool();
  await migrateDatabase(pool);
  return createApp({ repository: createRecipeRepository(pool), auth, ...options });
}

describe("recipe generation API", () => {
  it("returns a validated unsaved AI preview", async () => {
    const generateRecipe = vi.fn().mockResolvedValue({
      ...validRecipe,
      name: "Ethiopian Lentil Stew",
      source: "manual"
    });
    const app = await createTestApp({ generateRecipe });

    const response = await request(app)
      .post("/api/generate")
      .auth(auth.username, auth.password)
      .send({ dishName: "Ethiopian lentil stew" })
      .expect(200);

    expect(response.body.id).toBeUndefined();
    expect(response.body.source).toBe("ai");
    expect(response.body.name).toBe("Ethiopian Lentil Stew");
    expect(generateRecipe).toHaveBeenCalledWith("Ethiopian lentil stew");
    const result = await pool.query("SELECT COUNT(*)::int AS count FROM recipes WHERE source = 'ai'");
    expect(result.rows[0].count).toBe(0);
  });

  it("turns generator failure into a retryable response", async () => {
    const generateRecipe = vi.fn().mockRejectedValue(new Error("timeout"));
    const app = await createTestApp({ generateRecipe });

    const response = await request(app)
      .post("/api/generate")
      .auth(auth.username, auth.password)
      .send({ dishName: "Soup" })
      .expect(502);

    expect(response.body).toEqual({ error: "generation_failed" });
  });

  it("reports unavailable generation when no generator is configured", async () => {
    const app = await createTestApp();

    await request(app)
      .post("/api/generate")
      .auth(auth.username, auth.password)
      .send({ dishName: "Soup" })
      .expect(503, { error: "generation_unavailable" });
  });

  it("validates and trims the dish name before generation", async () => {
    const generateRecipe = vi.fn().mockResolvedValue(validRecipe);
    const app = await createTestApp({ generateRecipe });

    await request(app).post("/api/generate").auth(auth.username, auth.password)
      .send({ dishName: "   " }).expect(400);
    await request(app).post("/api/generate").auth(auth.username, auth.password)
      .send({ dishName: "x".repeat(101) }).expect(400);
    expect(generateRecipe).not.toHaveBeenCalled();
  });

  it("rejects an incomplete provider response without saving it", async () => {
    const generateRecipe = vi.fn().mockResolvedValue({ ...validRecipe, ingredients: [] });
    const app = await createTestApp({ generateRecipe });

    await request(app).post("/api/generate").auth(auth.username, auth.password)
      .send({ dishName: "Soup" }).expect(502, {
      error: "generation_failed"
    });
    const result = await pool.query("SELECT COUNT(*)::int AS count FROM recipes WHERE source = 'ai'");
    expect(result.rows[0].count).toBe(0);
  });
});
