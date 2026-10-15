import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../server/app.js";
import { openDatabase } from "../server/db.js";

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

let db;

afterEach(() => db?.close());

describe("recipe generation API", () => {
  it("returns a validated unsaved AI preview", async () => {
    const generateRecipe = vi.fn().mockResolvedValue({
      ...validRecipe,
      name: "Ethiopian Lentil Stew",
      source: "manual"
    });
    db = openDatabase(":memory:");
    const app = createApp({ db, generateRecipe });

    const response = await request(app)
      .post("/api/generate")
      .send({ dishName: "Ethiopian lentil stew" })
      .expect(200);

    expect(response.body.id).toBeUndefined();
    expect(response.body.source).toBe("ai");
    expect(response.body.name).toBe("Ethiopian Lentil Stew");
    expect(generateRecipe).toHaveBeenCalledWith("Ethiopian lentil stew");
    expect(db.prepare("SELECT COUNT(*) AS count FROM recipes WHERE source = 'ai'").get().count).toBe(0);
  });

  it("turns generator failure into a retryable response", async () => {
    const generateRecipe = vi.fn().mockRejectedValue(new Error("timeout"));
    db = openDatabase(":memory:");
    const app = createApp({ db, generateRecipe });

    const response = await request(app)
      .post("/api/generate")
      .send({ dishName: "Soup" })
      .expect(502);

    expect(response.body).toEqual({ error: "generation_failed" });
  });

  it("reports unavailable generation when no generator is configured", async () => {
    db = openDatabase(":memory:");
    const app = createApp({ db });

    await request(app)
      .post("/api/generate")
      .send({ dishName: "Soup" })
      .expect(503, { error: "generation_unavailable" });
  });

  it("validates and trims the dish name before generation", async () => {
    const generateRecipe = vi.fn().mockResolvedValue(validRecipe);
    db = openDatabase(":memory:");
    const app = createApp({ db, generateRecipe });

    await request(app).post("/api/generate").send({ dishName: "   " }).expect(400);
    await request(app).post("/api/generate").send({ dishName: "x".repeat(101) }).expect(400);
    expect(generateRecipe).not.toHaveBeenCalled();
  });

  it("rejects an incomplete provider response without saving it", async () => {
    const generateRecipe = vi.fn().mockResolvedValue({ ...validRecipe, ingredients: [] });
    db = openDatabase(":memory:");
    const app = createApp({ db, generateRecipe });

    await request(app).post("/api/generate").send({ dishName: "Soup" }).expect(502, {
      error: "generation_failed"
    });
    expect(db.prepare("SELECT COUNT(*) AS count FROM recipes WHERE source = 'ai'").get().count).toBe(0);
  });
});
