import { afterAll, describe, expect, it } from "vitest";
import { execPath } from "node:process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const serverEntryPoint = join(projectRoot, "server", "index.js");
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

export function startServer(databasePath) {
  const child = spawn(execPath, [serverEntryPoint], {
    cwd: projectRoot,
    env: { ...process.env, PORT: "0", DATABASE_PATH: databasePath },
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

async function postJson(url, path, body) {
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  expect(response.ok).toBe(true);
  return response.json();
}

async function getJson(url, path) {
  const response = await fetch(`${url}${path}`);
  expect(response.ok).toBe(true);
  return response.json();
}

describe("server restart persistence", () => {
  let tempDirectory;
  let server;

  afterAll(async () => {
    if (server) await stopServer(server.child);
    if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
  });

  it("keeps recipe data and app-recorded views after a server restart", async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), "cooking-saver-"));
    const databasePath = join(tempDirectory, "restart.sqlite");
    server = await startServer(databasePath);

    const created = await postJson(server.url, "/api/recipes", validRecipe);
    const viewed = await getJson(server.url, `/api/recipes/${created.id}`);
    expect(viewed.viewCount).toBe(1);

    await stopServer(server.child);
    server = await startServer(databasePath);

    const afterRestart = await getJson(server.url, `/api/recipes/${created.id}`);
    expect(afterRestart.name).toBe("Tomato Soup");
    expect(afterRestart.viewCount).toBe(2);
  });
});
