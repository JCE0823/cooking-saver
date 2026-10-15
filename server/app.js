import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGenerationRouter } from "./generation-route.js";
import { createRecipeRouter } from "./recipe-routes.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function createApp({ repository, generateRecipe } = {}) {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  const distPath = path.join(projectRoot, "dist");
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  if (repository) {
    app.use("/api/recipes", createRecipeRouter({ repository }));
  }

  app.use("/api/generate", createGenerationRouter({ generateRecipe }));

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
    if (status >= 500) {
      console.error(error);
    }

    return response.status(status).json({
      error: status >= 500 ? "internal_server_error" : "request_failed"
    });
  });

  return app;
}
