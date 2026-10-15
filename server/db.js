import pg from "pg";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STARTER_RECIPES } from "./starter-recipes.js";

const { Pool } = pg;
const migrationsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

export function openDatabase(connectionString) {
  return new Pool({ connectionString });
}

export async function migrateDatabase(pool) {
  const migrationPath = path.join(migrationsDirectory, "001-initial-schema.sql");
  const migrationSql = await readFile(migrationPath, "utf8");
  await pool.query(migrationSql);
}

export async function seedStarterRecipes(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const recipe of STARTER_RECIPES) {
      const result = await client.query(
        `INSERT INTO recipes
          (seed_key, name, prep_minutes, cook_minutes, servings, notes, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'starter')
         ON CONFLICT (seed_key) DO NOTHING
         RETURNING id`,
        [
          recipe.seedKey,
          recipe.name,
          recipe.prepMinutes,
          recipe.cookMinutes,
          recipe.servings,
          recipe.notes
        ]
      );

      if (result.rows.length === 0) continue;
      const recipeId = result.rows[0].id;

      // PostgreSQL returns no row for a conflict. Some in-memory PostgreSQL
      // test adapters return the conflicting row instead, so avoid duplicating
      // child rows when that adapter is used.
      const existingIngredients = await client.query(
        "SELECT 1 FROM ingredients WHERE recipe_id = $1 LIMIT 1",
        [recipeId]
      );
      if (existingIngredients.rows.length > 0) continue;

      for (const [position, ingredient] of recipe.ingredients.entries()) {
        await client.query(
          `INSERT INTO ingredients (recipe_id, position, quantity, name)
           VALUES ($1, $2, $3, $4)`,
          [recipeId, position + 1, ingredient.quantity, ingredient.name]
        );
      }

      for (const [position, text] of recipe.instructions.entries()) {
        await client.query(
          `INSERT INTO instructions (recipe_id, position, text)
           VALUES ($1, $2, $3)`,
          [recipeId, position + 1, text]
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
