import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "../server/db.js";
import { createRecipeRepository } from "../server/recipe-repository.js";
import { createTestPool } from "./postgres.js";

const originalRecipe = {
  name: "Original Soup",
  prepMinutes: 10,
  cookMinutes: 25,
  servings: 4,
  notes: "Original notes.",
  source: "manual",
  ingredients: [{ quantity: "2", name: "tomatoes" }],
  instructions: ["Simmer the soup."]
};

const updatedRecipe = {
  ...originalRecipe,
  name: "Updated Soup",
  ingredients: [{ quantity: "3", name: "tomatoes" }],
  instructions: ["Blend the soup."]
};

let pool;

afterEach(async () => {
  await pool?.end();
  pool = undefined;
});

describe("shared recipe copying", () => {
  it.skipIf(!process.env.TEST_DATABASE_URL)("keeps scalar and child data from one source snapshot", async () => {
    pool = createTestPool();
    await migrateDatabase(pool);
    const repository = createRecipeRepository(pool);
    const shared = await repository.createShared(originalRecipe);

    let reachedSourceRead;
    const sourceRead = new Promise((resolve) => { reachedSourceRead = resolve; });
    let releaseCopy;
    const copyReleased = new Promise((resolve) => { releaseCopy = resolve; });
    const originalConnect = pool.connect.bind(pool);
    pool.connect = async () => {
      const client = await originalConnect();
      const originalQuery = client.query.bind(client);
      client.query = async (...args) => {
        const text = typeof args[0] === "string" ? args[0] : args[0]?.text;
        const result = await originalQuery(...args);
        if (text?.includes("SELECT * FROM recipes WHERE id = $1 AND owner_user_id IS NULL")) {
          reachedSourceRead();
          await copyReleased;
        }
        return result;
      };
      return client;
    };

    const copyPromise = repository.copyShared(shared.id, 42);
    await sourceRead;

    let updateFinished = false;
    const updatePromise = repository.updateShared(shared.id, updatedRecipe)
      .then((result) => {
        updateFinished = true;
        return result;
      });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(updateFinished).toBe(false);

    releaseCopy();
    const copied = await copyPromise;
    await updatePromise;

    expect(copied).toMatchObject({
      name: originalRecipe.name,
      prepMinutes: originalRecipe.prepMinutes,
      cookMinutes: originalRecipe.cookMinutes,
      servings: originalRecipe.servings,
      notes: originalRecipe.notes,
      ingredients: originalRecipe.ingredients,
      instructions: originalRecipe.instructions
    });
  });
});
