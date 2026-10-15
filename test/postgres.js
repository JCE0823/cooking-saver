import pg from "pg";
import { newDb } from "pg-mem";

const { Pool } = pg;

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export async function resetTestDatabase(pool) {
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
