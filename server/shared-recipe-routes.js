import express from "express";
import { recipeInputSchema } from "./recipe-schema.js";

function parseId(value) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function validationFields(error) {
  const fields = {};
  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "body";
    fields[field] ??= [];
    fields[field].push(issue.message);
  }
  return fields;
}

function sendInvalidId(response) {
  return response.status(400).json({
    error: "validation_failed",
    fields: { id: ["must be a positive integer"] }
  });
}

function parseRecipeBody(request, response) {
  const result = recipeInputSchema.safeParse(request.body);
  if (!result.success) {
    response.status(400).json({
      error: "validation_failed",
      fields: validationFields(result.error)
    });
    return null;
  }
  return result.data;
}

export function createSharedRecipeRouter({ repository }) {
  const router = express.Router();

  function requireOwner(request, response, next) {
    if (request.user.role !== "owner") {
      return response.status(403).json({ error: "owner_required" });
    }
    return next();
  }

  router.get("/", async (_request, response, next) => {
    try {
      response.json(await repository.listShared());
    } catch (error) {
      next(error);
    }
  });

  router.post("/", requireOwner, async (request, response, next) => {
    const input = parseRecipeBody(request, response);
    if (!input) return;
    try {
      response.status(201).json(await repository.createShared(input));
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", requireOwner, async (request, response, next) => {
    const id = parseId(request.params.id);
    if (id === null) return sendInvalidId(response);
    const input = parseRecipeBody(request, response);
    if (!input) return;
    try {
      const recipe = await repository.updateShared(id, input);
      if (!recipe) return response.status(404).json({ error: "recipe_not_found" });
      return response.json(recipe);
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:id", requireOwner, async (request, response, next) => {
    const id = parseId(request.params.id);
    if (id === null) return sendInvalidId(response);
    try {
      if (!(await repository.removeShared(id))) {
        return response.status(404).json({ error: "recipe_not_found" });
      }
      return response.status(204).send();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
