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

async function createRecipe(app, recipe) {
  const response = await request(app).post("/api/recipes")
    .auth(auth.username, auth.password).send(recipe).expect(201);
  return response.body;
}

describe("recipe search and views", () => {
  it("searches by partial name without case sensitivity", async () => {
    pool = createTestPool();
    await migrateDatabase(pool);
    const app = createApp({ repository: createRecipeRepository(pool), auth });
    await createRecipe(app, { ...validRecipe, name: "Chicken Alfredo" });
    await createRecipe(app, { ...validRecipe, name: "Chicken Curry" });

    const response = await request(app).get("/api/recipes/search?q=CHICKEN")
      .auth(auth.username, auth.password).expect(200);

    expect(response.body.map((recipe) => recipe.name)).toEqual([
      "Chicken Alfredo",
      "Chicken Curry"
    ]);
  });

  it("increments only when a full recipe is opened", async () => {
    pool = createTestPool();
    await migrateDatabase(pool);
    const app = createApp({ repository: createRecipeRepository(pool), auth });
    const created = await createRecipe(app, validRecipe);

    await request(app).get("/api/recipes/search?q=tomato").auth(auth.username, auth.password)
      .expect(200);
    const opened = await request(app).get(`/api/recipes/${created.id}`)
      .auth(auth.username, auth.password).expect(200);
    expect(opened.body.viewCount).toBe(1);

    const openedAgain = await request(app).get(`/api/recipes/${created.id}`)
      .auth(auth.username, auth.password).expect(200);
    expect(openedAgain.body.viewCount).toBe(2);
  });

  it("treats LIKE wildcard characters in the query as literals", async () => {
    pool = createTestPool();
    await migrateDatabase(pool);
    const app = createApp({ repository: createRecipeRepository(pool), auth });
    await createRecipe(app, { ...validRecipe, name: "A% Soup" });
    await createRecipe(app, { ...validRecipe, name: "AB Soup" });

    const response = await request(app).get("/api/recipes/search?q=%")
      .auth(auth.username, auth.password).expect(200);

    expect(response.body.map((recipe) => recipe.name)).toEqual(["A% Soup"]);
  });
});
