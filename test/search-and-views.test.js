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

async function createRecipe(app, recipe) {
  const response = await request(app).post("/api/recipes").send(recipe).expect(201);
  return response.body;
}

describe("recipe search and views", () => {
  it("searches by partial name without case sensitivity", async () => {
    db = openDatabase(":memory:");
    const app = createApp({ db });
    await createRecipe(app, { ...validRecipe, name: "Chicken Alfredo" });
    await createRecipe(app, { ...validRecipe, name: "Chicken Curry" });

    const response = await request(app).get("/api/recipes/search?q=CHICKEN").expect(200);

    expect(response.body.map((recipe) => recipe.name)).toEqual([
      "Chicken Alfredo",
      "Chicken Curry"
    ]);
  });

  it("increments only when a full recipe is opened", async () => {
    db = openDatabase(":memory:");
    const app = createApp({ db });
    const created = await createRecipe(app, validRecipe);

    await request(app).get("/api/recipes/search?q=tomato").expect(200);
    const opened = await request(app).get(`/api/recipes/${created.id}`).expect(200);
    expect(opened.body.viewCount).toBe(1);

    const openedAgain = await request(app).get(`/api/recipes/${created.id}`).expect(200);
    expect(openedAgain.body.viewCount).toBe(2);
  });
});
