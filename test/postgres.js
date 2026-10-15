import pg from "pg";
import { newDb } from "pg-mem";

const { Pool } = pg;

export function createTestPool() {
  if (process.env.TEST_DATABASE_URL) {
    return new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  }

  const database = newDb({ noAstCoverageCheck: true });
  const { Pool: MemoryPool } = database.adapters.createPg();
  return new MemoryPool();
}
