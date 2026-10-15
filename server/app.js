import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAuthRouter } from "./auth-routes.js";
import { createGenerationRouter } from "./generation-route.js";
import { createRecipeRouter } from "./recipe-routes.js";
import { createSharedRecipeRouter } from "./shared-recipe-routes.js";
import { createSessionAuth } from "./session-auth.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATABASE_CONNECTION_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "EAI_FAIL",
  "EAI_NODATA",
  "EAI_NONAME",
  "EHOSTDOWN",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
  "57P01"
]);

function isDatabaseUnavailable(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  return code.startsWith("08") || DATABASE_CONNECTION_ERROR_CODES.has(code);
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
  authRepository,
  generateRecipe,
  verifier,
  ownerEmail,
  googleClientId,
  secureCookies = true,
  now,
  randomToken,
  allowedOrigins = [],
  commit
} = {}) {
  const app = express();
  app.use((request, response, next) => {
    const startedAt = performance.now();
    response.on("finish", () => {
      console.log({
        method: request.method,
        path: request.originalUrl.split("?", 1)[0],
        status: response.statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10
      });
    });
    next();
  });
  app.use(express.json());
  const origins = new Set(
    (Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins]).filter(Boolean)
  );
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      callback(null, !origin || origins.has(origin));
    }
  }));

  app.get("/api/version", (_request, response) => {
    response.json({ commit: commit || "local" });
  });

  const sessionRepository = authRepository || repository;
  app.use("/api", createAuthRouter({
    verifier,
    repository: sessionRepository,
    ownerEmail,
    googleClientId,
    secureCookies,
    now,
    randomToken
  }));
  app.use("/api", createSessionAuth({ repository: sessionRepository, ownerEmail, now }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  if (repository) {
    app.use("/api/recipes", createRecipeRouter({ repository }));
    app.use("/api/shared-recipes", createSharedRecipeRouter({ repository }));
  }

  app.use("/api/generate", createGenerationRouter({ generateRecipe }));

  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "not_found" });
  });

  const distPath = path.join(projectRoot, "dist");
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("/{*path}", (request, response, next) => {
      if (request.path.startsWith("/api/")) return next();
      return response.sendFile(path.join(distPath, "index.html"));
    });
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
