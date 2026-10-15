import { describe, expect, it } from "vitest";
import { newDb } from "pg-mem";
import { resetWhenClosed } from "./postgres.js";

describe("PostgreSQL test isolation", () => {
  it("removes every public table before the database is reused", async () => {
    const database = newDb({ noAstCoverageCheck: true });
    const { Pool } = database.adapters.createPg();
    const firstPool = new Pool();
    firstPool.__cookingSaverTestAdapter = "pg-mem";
    resetWhenClosed(firstPool);
    const secondPool = new Pool();

    try {
      await firstPool.query("CREATE TABLE contamination_probe (value TEXT)");
      await firstPool.query("INSERT INTO contamination_probe (value) VALUES ('left behind')");
      await firstPool.query("CREATE TABLE users (id BIGINT PRIMARY KEY)");
      await firstPool.query("CREATE TABLE sessions (id BIGINT PRIMARY KEY)");
      await firstPool.query("CREATE TABLE recipes (id BIGINT PRIMARY KEY)");

      await firstPool.end();

      const remaining = await secondPool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      );
      expect(remaining.rows).toEqual([]);
    } finally {
      await firstPool.end();
      await secondPool.end();
    }
  });
});
