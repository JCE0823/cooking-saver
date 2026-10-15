import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateDatabase, openDatabase, seedStarterRecipes } from "../server/db.js";
import { createTestPool } from "./postgres.js";

let pool;

afterEach(async () => {
  await pool?.end();
});

describe("PostgreSQL database", () => {
  it("uses bounded PostgreSQL connection and query timeouts", async () => {
    pool = openDatabase("postgresql://localhost/cooking_saver_test");
    expect(pool.options.connectionTimeoutMillis).toBe(5000);
    expect(pool.options.idleTimeoutMillis).toBe(30000);
    expect(pool.options.statement_timeout).toBe(10000);
    expect(pool.options.query_timeout).toBe(10000);
    await pool.end();
    pool = undefined;
  });

  it("creates exactly ten starter recipes idempotently", async () => {
    pool = createTestPool();
    await migrateDatabase(pool);
    await seedStarterRecipes(pool);
    await migrateDatabase(pool);
    await seedStarterRecipes(pool);

    const result = await pool.query(
      "SELECT name, view_count FROM recipes WHERE source = 'starter' ORDER BY name"
    );
    expect(result.rows).toHaveLength(10);
    expect(result.rows.every((row) => row.view_count === 0)).toBe(true);
    expect(result.rows.map((row) => row.name)).toContain("Chocolate Chip Cookies");

    const migrations = await pool.query("SELECT version FROM schema_migrations ORDER BY version");
    expect(migrations.rows.map((row) => row.version)).toEqual([
      "001-initial-schema.sql",
      "002-starter-seed-state.sql",
      "003-users-sessions-and-recipe-owners.sql"
    ]);
  });

  it("migrates existing recipes into the shared collection", async () => {
    pool = createTestPool();
    await migrateDatabase(pool);
    await seedStarterRecipes(pool);

    const users = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position"
    );
    const sessions = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions' ORDER BY ordinal_position"
    );
    const recipes = await pool.query(
      "SELECT COUNT(*)::int AS count FROM recipes WHERE owner_user_id IS NULL"
    );

    expect(users.rows.map((row) => row.column_name)).toEqual([
      "id", "google_subject", "email", "display_name", "picture_url", "created_at", "updated_at"
    ]);
    expect(sessions.rows.map((row) => row.column_name)).toEqual([
      "id", "token_hash", "user_id", "expires_at", "revoked_at", "created_at"
    ]);
    expect(recipes.rows[0].count).toBe(10);
  });

  it("does not restore a deliberately deleted starter after a later seed", async () => {
    pool = createTestPool();
    await migrateDatabase(pool);
    await seedStarterRecipes(pool);

    await pool.query("DELETE FROM recipes WHERE seed_key = $1", ["pancakes"]);
    await seedStarterRecipes(pool);

    const result = await pool.query(
      "SELECT COUNT(*)::int AS count FROM recipes WHERE source = 'starter'"
    );
    expect(result.rows[0].count).toBe(9);
  });

  it.skipIf(!process.env.TEST_DATABASE_URL)("serializes concurrent starter seeding", async () => {
    pool = createTestPool();
    await migrateDatabase(pool);

    await Promise.all([
      seedStarterRecipes(pool),
      seedStarterRecipes(pool)
    ]);

    const recipes = await pool.query(
      "SELECT COUNT(*)::int AS count FROM recipes WHERE source = 'starter'"
    );
    const installations = await pool.query(
      "SELECT COUNT(*)::int AS count FROM seed_installations WHERE seed_name = $1",
      ["starter-recipes-v1"]
    );
    expect(recipes.rows[0].count).toBe(10);
    expect(installations.rows[0].count).toBe(1);
  });

  it("discovers and records ordered pending migrations", async () => {
    pool = createTestPool();
    const directory = await mkdtemp(join(tmpdir(), "cooking-saver-migrations-"));
    try {
      await writeFile(join(directory, "002-add-name.sql"),
        "ALTER TABLE migration_probe ADD COLUMN name TEXT;");
      await writeFile(join(directory, "001-create-probe.sql"),
        "CREATE TABLE migration_probe (value INTEGER NOT NULL);");

      await migrateDatabase(pool, { directory });
      await migrateDatabase(pool, { directory });

      const columns = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
        ["migration_probe"]
      );
      expect(columns.rows.map((row) => row.column_name)).toEqual(["value", "name"]);
      const ledger = await pool.query(
        "SELECT version FROM schema_migrations WHERE version IN ($1, $2) ORDER BY version",
        ["001-create-probe.sql", "002-add-name.sql"]
      );
      expect(ledger.rows.map((row) => row.version)).toEqual([
        "001-create-probe.sql",
        "002-add-name.sql"
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("can retry a migration after its first transaction fails", async () => {
    pool = createTestPool();
    const directory = await mkdtemp(join(tmpdir(), "cooking-saver-retry-"));
    try {
      await writeFile(join(directory, "001-retry-base.sql"),
        "CREATE TABLE retry_probe (value INTEGER NOT NULL);");
      const pendingPath = join(directory, "002-retry.sql");
      await writeFile(pendingPath,
        "SELECT * FROM missing_retry_table; ALTER TABLE retry_probe ADD COLUMN broken TEXT;");

      await expect(migrateDatabase(pool, { directory })).rejects.toThrow();
      await writeFile(pendingPath, "ALTER TABLE retry_probe ADD COLUMN fixed TEXT;");
      await migrateDatabase(pool, { directory });

      const columns = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
        ["retry_probe"]
      );
      expect(columns.rows.map((row) => row.column_name)).toEqual(["value", "fixed"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
