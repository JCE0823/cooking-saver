import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../server/app.js";
import { openDatabase } from "../server/db.js";

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

let db;

afterEach(() => db?.close());

describe("recipe API", () => {
  it("creates, updates, and deletes a complete recipe", async () => {
    db = openDatabase(":memory:");
    const app = createApp({ db });

    const created = await request(app).post("/api/recipes").send(validRecipe).expect(201);
    expect(created.body.name).toBe("Tomato Soup");
    expect(created.body.ingredients).toEqual(validRecipe.ingredients);

    const updated = await request(app)
      .put(`/api/recipes/${created.body.id}`)
      .send({ ...validRecipe, servings: 6 })
      .expect(200);
    expect(updated.body.servings).toBe(6);

    await request(app).delete(`/api/recipes/${created.body.id}`).expect(204);
    await request(app).get(`/api/recipes/${created.body.id}`).expect(404);
  });

  it("rejects a recipe without ingredients", async () => {
    db = openDatabase(":memory:");
    const app = createApp({ db });

    const response = await request(app)
      .post("/api/recipes")
      .send({ ...validRecipe, ingredients: [] })
      .expect(400);
    expect(response.body.error).toBe("validation_failed");
  });

  it("preserves the view count when updating recipe content", async () => {
    db = openDatabase(":memory:");
    const app = createApp({ db });

    const created = await request(app).post("/api/recipes").send(validRecipe).expect(201);
    db.prepare("UPDATE recipes SET view_count = 7 WHERE id = ?").run(created.body.id);

    const updated = await request(app)
      .put(`/api/recipes/${created.body.id}`)
      .send({ ...validRecipe, name: "Updated Tomato Soup" })
      .expect(200);
    expect(updated.body.viewCount).toBe(7);
  });
});
