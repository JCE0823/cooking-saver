import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase, seedStarterRecipes } from "../server/db.js";
import { createTestPool } from "./postgres.js";

let pool;

afterEach(async () => {
  await pool?.end();
});

describe("PostgreSQL database", () => {
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
  });
});
