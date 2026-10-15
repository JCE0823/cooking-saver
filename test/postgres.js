import pg from "pg";
import { newDb } from "pg-mem";

const { Pool } = pg;
const APPLICATION_DATA_TABLES = [
  "instructions",
  "ingredients",
  "sessions",
  "recipes",
  "users",
  "seed_installations"
];
const APPLICATION_TABLES = new Set([...APPLICATION_DATA_TABLES, "schema_migrations"]);
const APPLICATION_MIGRATIONS = [
  "001-initial-schema.sql",
  "002-starter-seed-state.sql",
  "003-users-sessions-and-recipe-owners.sql"
];

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export async function resetTestDatabase(pool) {
  if (pool.__cookingSaverTestAdapter !== "pg-mem") {
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tableNames = tables.rows.map(({ table_name: tableName }) => tableName);
    const truncatable = APPLICATION_DATA_TABLES.filter((tableName) => tableNames.includes(tableName));

    if (truncatable.length > 0) {
      await pool.query(
        `TRUNCATE ${truncatable.map(quoteIdentifier).join(", ")} RESTART IDENTITY CASCADE`
      );
    }

    if (tableNames.includes("schema_migrations")) {
      await pool.query(
        "DELETE FROM schema_migrations WHERE version <> ALL($1::text[])",
        [APPLICATION_MIGRATIONS]
      );
    }

    const temporaryTables = tableNames.filter((tableName) => !APPLICATION_TABLES.has(tableName));
    if (temporaryTables.length > 0) {
      await pool.query(
        `DROP TABLE IF EXISTS ${temporaryTables.map(quoteIdentifier).join(", ")} CASCADE`
      );
    }
    return;
  }

  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
  );

  if (tables.rows.length === 0) return;

  const names = tables.rows.map(({ table_name: tableName }) => quoteIdentifier(tableName));
  await pool.query(`DROP TABLE IF EXISTS ${names.join(", ")} CASCADE`);
}

export function resetWhenClosed(pool) {
  const closePool = pool.end.bind(pool);
  let closing;

  pool.end = () => {
    closing ??= (async () => {
      try {
        await resetTestDatabase(pool);
      } finally {
        await closePool();
      }
    })();
    return closing;
  };

  return pool;
}

export function createTestPool() {
  if (process.env.TEST_DATABASE_URL) {
    return resetWhenClosed(new Pool({ connectionString: process.env.TEST_DATABASE_URL }));
  }

  const database = newDb({ noAstCoverageCheck: true });
  const { Pool: MemoryPool } = database.adapters.createPg();
  const pool = new MemoryPool();
  pool.__cookingSaverTestAdapter = "pg-mem";
  return resetWhenClosed(pool);
}
