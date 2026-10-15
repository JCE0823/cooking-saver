import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STARTER_RECIPES } from "./starter-recipes.js";

const { Pool } = pg;
const migrationsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const MIGRATION_LOCK_ID = 785421;
const MIGRATION_LEDGER_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;
const SEED_VERSION = "starter-recipes-v1";

export function openDatabase(connectionString) {
  return new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    query_timeout: 10000
  });
}

export async function discoverMigrations(directory = migrationsDirectory) {
  const filenames = (await readdir(directory))
    .filter((filename) => /^\d+[\w-]*\.sql$/i.test(filename))
    .sort((left, right) => {
      const leftVersion = Number(left.match(/^\d+/)[0]);
      const rightVersion = Number(right.match(/^\d+/)[0]);
      return leftVersion - rightVersion || left.localeCompare(right);
    });

  return Promise.all(filenames.map(async (filename) => ({
    version: filename,
    sql: await readFile(path.join(directory, filename), "utf8")
  })));
}

export async function migrateDatabase(pool, { directory = migrationsDirectory } = {}) {
  const migrations = await discoverMigrations(directory);
  const client = await pool.connect();
  let migrationLockHeld = false;

  try {
    // pg-mem does not implement advisory locks. Its pools are process-local test
    // adapters; real PostgreSQL uses the lock to serialize startup migrations.
    if (pool.__cookingSaverTestAdapter !== "pg-mem") {
      await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
      migrationLockHeld = true;
    }

    await client.query("BEGIN");
    await client.query(MIGRATION_LEDGER_SQL);
    await client.query("COMMIT");

    for (const migration of migrations) {
      await client.query("BEGIN");
      const applied = await client.query(
        "SELECT 1 FROM schema_migrations WHERE version = $1",
        [migration.version]
      );
      if (applied.rows.length === 0) {
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [migration.version]
        );
      }
      await client.query("COMMIT");
    }
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the migration error when rollback itself is unavailable.
    }
    throw error;
  } finally {
    if (migrationLockHeld) {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
    }
    client.release();
  }
}

export async function seedStarterRecipes(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const completed = await client.query(
      "SELECT 1 FROM seed_installations WHERE seed_name = $1",
      [SEED_VERSION]
    );
    if (completed.rows.length > 0) {
      await client.query("COMMIT");
      return;
    }

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

      let recipeId = result.rows[0]?.id;
      if (recipeId === undefined) {
        const existing = await client.query(
          "SELECT id FROM recipes WHERE seed_key = $1",
          [recipe.seedKey]
        );
        recipeId = existing.rows[0]?.id;
      }
      if (recipeId === undefined) throw new Error(`Missing starter recipe ${recipe.seedKey}`);

      // A transaction that was interrupted cannot leave this state, but this
      // also repairs an externally-created partial starter before marking the
      // installation complete.
      await client.query("DELETE FROM ingredients WHERE recipe_id = $1", [recipeId]);
      await client.query("DELETE FROM instructions WHERE recipe_id = $1", [recipeId]);

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
    await client.query(
      "INSERT INTO seed_installations (seed_name) VALUES ($1)",
      [SEED_VERSION]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
