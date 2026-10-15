import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBasicAuth } from "./basic-auth.js";
import { createGenerationRouter } from "./generation-route.js";
import { createRecipeRouter } from "./recipe-routes.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function isDatabaseUnavailable(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  return code.startsWith("08")
    || ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "57P01"].includes(code);
}

function logError(error) {
  console.error({
    name: error?.name,
    code: error?.code,
    stack: error?.stack
  });
}

export function createApp({
  repository,
  generateRecipe,
  auth,
  allowedOrigins = [],
  commit
} = {}) {
  const app = express();
  app.use(express.json());
  const origins = new Set(
    (Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins]).filter(Boolean)
  );
  app.use(cors({
    origin(origin, callback) {
      callback(null, !origin || origins.has(origin));
    }
  }));

  app.get("/api/version", (_request, response) => {
    response.json({ commit: commit || "local" });
  });

  app.use("/api", createBasicAuth(auth));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  if (repository) {
    app.use("/api/recipes", createRecipeRouter({ repository }));
  }

  app.use("/api/generate", createGenerationRouter({ generateRecipe }));

  const distPath = path.join(projectRoot, "dist");
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  // Keep parser and unexpected server failures in the JSON API shape. Route
  // handlers that already sent a response are left to Express to finish.
  app.use((error, _request, response, next) => {
    if (response.headersSent) return next(error);

    if (error?.type === "entity.parse.failed") {
      return response.status(400).json({ error: "invalid_json" });
    }

    const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
      ? error.status
      : 500;
    if (isDatabaseUnavailable(error)) {
      logError(error);
      return response.status(503).json({ error: "database_unavailable" });
    }
    if (status >= 500) {
      logError(error);
    }

    return response.status(status).json({
      error: status >= 500 ? "internal_server_error" : "request_failed"
    });
  });

  return app;
}
