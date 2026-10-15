import "dotenv/config";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAiGenerator } from "./ai-generator.js";
import { createApp } from "./app.js";
import { openDatabase } from "./db.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databasePath = path.resolve(projectRoot, process.env.DATABASE_PATH || "./data/cooking-saver.sqlite");
mkdirSync(path.dirname(databasePath), { recursive: true });

const db = openDatabase(databasePath);
const hasUmgptConfiguration = [process.env.UMGPT_API_KEY, process.env.UMGPT_MODEL]
  .every((value) => typeof value === "string" && value.trim() !== "");
const generateRecipe = hasUmgptConfiguration
  ? createAiGenerator({
      apiKey: process.env.UMGPT_API_KEY,
      model: process.env.UMGPT_MODEL,
      baseURL: process.env.UMGPT_BASE_URL
    })
  : undefined;
const app = createApp({ db, generateRecipe });
const port = Number(process.env.PORT || 3000);

const server = app.listen(port, () => {
  console.log(`LISTENING ${server.address().port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
