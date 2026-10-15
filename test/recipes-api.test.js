import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../server/app.js";
import { migrateDatabase } from "../server/db.js";
import { createRecipeRepository } from "../server/recipe-repository.js";
import { createTestPool } from "./postgres.js";

const validRecipe = {
  name: "Tomato Soup",
  prepMinutes: 10,
  cookMinutes: 25,
  servings: 4,
  notes: "Serve warm.",
  source: "manual",
  ingredients: [{ quantity: "4", name: "tomatoes" }],
  instructions: ["Chop the tomatoes.", "Simmer until tender."]
};
const auth = { username: "student", password: "correct horse battery staple" };

let pool;

afterEach(async () => {
  await pool?.end();
});

describe("recipe API", () => {
  it("creates, updates, and deletes a complete recipe", async () => {
    pool = createTestPool();
    await migrateDatabase(pool);
    const repository = createRecipeRepository(pool);
    const app = createApp({ repository, auth });

    const created = await request(app).post("/api/recipes").auth(auth.username, auth.password)
      .send(validRecipe).expect(201);
    expect(created.body.name).toBe("Tomato Soup");
    expect(created.body.ingredients).toEqual(validRecipe.ingredients);
    const persisted = await pool.query(
      "SELECT name, servings FROM recipes WHERE id = $1",
      [created.body.id]
    );
    expect(persisted.rows[0]).toEqual({ name: "Tomato Soup", servings: 4 });

    const updated = await request(app)
      .put(`/api/recipes/${created.body.id}`)
      .auth(auth.username, auth.password)
      .send({ ...validRecipe, servings: 6 })
      .expect(200);
    expect(updated.body.servings).toBe(6);

    await request(app).delete(`/api/recipes/${created.body.id}`).auth(auth.username, auth.password)
      .expect(204);
    await request(app).get(`/api/recipes/${created.body.id}`).auth(auth.username, auth.password)
      .expect(404);
  });

  it("rejects a recipe without ingredients", async () => {
    pool = createTestPool();
    await migrateDatabase(pool);
    const repository = createRecipeRepository(pool);
    const app = createApp({ repository, auth });

    const response = await request(app)
      .post("/api/recipes")
      .auth(auth.username, auth.password)
      .send({ ...validRecipe, ingredients: [] })
      .expect(400);
    expect(response.body.error).toBe("validation_failed");
  });

  it("preserves the view count when updating recipe content", async () => {
    pool = createTestPool();
    await migrateDatabase(pool);
    const repository = createRecipeRepository(pool);
    const app = createApp({ repository, auth });

    const created = await request(app).post("/api/recipes").auth(auth.username, auth.password)
      .send(validRecipe).expect(201);
    await pool.query("UPDATE recipes SET view_count = 7 WHERE id = $1", [created.body.id]);

    const updated = await request(app)
      .put(`/api/recipes/${created.body.id}`)
      .auth(auth.username, auth.password)
      .send({ ...validRecipe, name: "Updated Tomato Soup" })
      .expect(200);
    expect(updated.body.viewCount).toBe(7);
  });
});
