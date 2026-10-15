import "dotenv/config";
import { createApp } from "./app.js";
import { createRecipeRepository } from "./recipe-repository.js";
import { migrateDatabase, openDatabase, seedStarterRecipes } from "./db.js";
import { loadConfig } from "./config.js";

function safeError(error) {
  return { name: error?.name, code: error?.code, stack: error?.stack };
}

let pool;
let server;
let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool?.end();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function start() {
  try {
    const config = loadConfig(process.env);
    pool = openDatabase(config.databaseUrl);
    await migrateDatabase(pool);
    await seedStarterRecipes(pool);
    const repository = createRecipeRepository(pool);
    const app = createApp({
      repository,
      auth: { username: config.username, password: config.password },
      allowedOrigins: config.allowedOrigins,
      commit: config.commit
    });

    server = app.listen(config.port, "0.0.0.0", () => {
      console.log(`LISTENING ${server.address().port}`);
    });
  } catch (error) {
    console.error(safeError(error));
    await pool?.end();
    process.exitCode = 1;
  }
}

start();
