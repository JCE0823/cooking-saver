import { afterAll, describe, expect, it } from "vitest";
import { execPath } from "node:process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createTestPool } from "./postgres.js";
import { TEST_SESSION_COOKIE, seedTestUser } from "./session-auth-fixture.js";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const serverEntryPoint = join(projectRoot, "server", "index.js");
const databaseUrl = process.env.TEST_DATABASE_URL;
const validRecipe = {
  name: "Tomato Soup",
  prepMinutes: 10,
  cookMinutes: 25,
  servings: 4,
  notes: "Serve warm.",
  source: "manual",
  ingredients: [{ quantity: "4", name: "tomatoes" }],
  instructions: ["Chop the tomatoes.", "Simmer until tender."]
};

export function startServer(connectionString) {
  const child = spawn(execPath, [serverEntryPoint], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: "0",
      DATABASE_URL: connectionString,
      GOOGLE_CLIENT_ID: "google-client-id",
      OWNER_EMAIL: "student@example.com",
      FRONTEND_ORIGIN: "http://localhost:3000",
      RENDER_GIT_COMMIT: "test"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      const match = output.match(/LISTENING\s+(\d+)/);
      if (match && !settled) {
        settled = true;
        resolve({ child, url: `http://127.0.0.1:${match[1]}` });
      }
    });
    child.on("error", fail);
    child.on("exit", (code, signal) => {
      if (!settled) {
        fail(new Error(`Server exited before listening (code=${code}, signal=${signal})`));
      }
    });
  });
}

export function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const onError = (error) => {
      child.off("exit", onExit);
      reject(error);
    };
    const onExit = () => {
      child.off("error", onError);
      resolve();
    };

    child.once("error", onError);
    child.once("exit", onExit);
    child.kill(process.platform === "win32" ? "SIGINT" : "SIGTERM");
  });
}

let sessionPool;
let sessionReady = false;

async function ensureSession() {
  if (sessionReady) return;
  sessionPool ??= createTestPool();
  await seedTestUser(sessionPool);
  sessionReady = true;
}

async function postJson(url, path, body) {
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: TEST_SESSION_COOKIE
    },
    body: JSON.stringify(body)
  });
  expect(response.ok).toBe(true);
  return response.json();
}

async function getJson(url, path) {
  const response = await fetch(`${url}${path}`, {
    headers: { cookie: TEST_SESSION_COOKIE }
  });
  expect(response.ok).toBe(true);
  return response.json();
}

async function request(url, path, method) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: { cookie: TEST_SESSION_COOKIE }
  });
  expect(response.ok).toBe(true);
}

describe("server restart persistence", () => {
  let server;

  afterAll(async () => {
    if (server) await stopServer(server.child);
    await sessionPool?.end();
  });

  it.skipIf(!databaseUrl)("keeps recipe data and app-recorded views after a server restart", async () => {
    server = await startServer(databaseUrl);
    await ensureSession();

    const created = await postJson(server.url, "/api/recipes", validRecipe);
    const viewed = await getJson(server.url, `/api/recipes/${created.id}`);
    expect(viewed.viewCount).toBe(1);

    await stopServer(server.child);
    server = await startServer(databaseUrl);

    const afterRestart = await getJson(server.url, `/api/recipes/${created.id}`);
    expect(afterRestart.name).toBe("Tomato Soup");
    expect(afterRestart.viewCount).toBe(2);

    await request(server.url, `/api/recipes/${created.id}`, "DELETE");
  });

  it.skipIf(!databaseUrl)("keeps a deleted starter recipe deleted after a restart", async () => {
    server = await startServer(databaseUrl);
    await ensureSession();

    const before = await getJson(server.url, "/api/recipes");
    const pancakes = before.find((recipe) => recipe.name === "Pancakes");
    expect(pancakes).toBeDefined();
    await request(server.url, `/api/recipes/${pancakes.id}`, "DELETE");

    await stopServer(server.child);
    server = await startServer(databaseUrl);

    const after = await getJson(server.url, "/api/recipes");
    expect(after.some((recipe) => recipe.name === "Pancakes")).toBe(false);
  });

  it.skipIf(!databaseUrl)("serves the SPA for browser routes and JSON for missing API routes", async () => {
    server = await startServer(databaseUrl);
    await ensureSession();

    const page = await fetch(`${server.url}/recipes`, {
      headers: { accept: "text/html" }
    });
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toMatch(/text\/html/);
    expect(await page.text()).toContain("<div id=\"root\">");

    const missing = await fetch(`${server.url}/api/missing`, {
      headers: { cookie: TEST_SESSION_COOKIE }
    });
    expect(missing.status).toBe(404);
    expect(missing.headers.get("content-type")).toMatch(/application\/json/);
    expect(await missing.json()).toEqual({ error: "not_found" });
  });
});
