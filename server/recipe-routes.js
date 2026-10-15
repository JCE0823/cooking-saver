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

export function createRecipeRouter({ repository }) {
  const router = express.Router();

  router.get("/", async (_request, response, next) => {
    try {
      response.json(await repository.list());
    } catch (error) {
      next(error);
    }
  });

  router.get("/search", async (request, response, next) => {
    try {
      response.json(await repository.search(request.query.q));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    const id = parseId(request.params.id);
    if (id === null) return sendInvalidId(response);
    try {
      const recipe = await repository.getByIdAndRecordView(id);
      if (!recipe) return response.status(404).json({ error: "recipe_not_found" });
      return response.json(recipe);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    const input = parseRecipeBody(request, response);
    if (!input) return;
    try {
      response.status(201).json(await repository.create(input));
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", async (request, response, next) => {
    const id = parseId(request.params.id);
    if (id === null) return sendInvalidId(response);
    const input = parseRecipeBody(request, response);
    if (!input) return;
    try {
      const recipe = await repository.update(id, input);
      if (!recipe) return response.status(404).json({ error: "recipe_not_found" });
      return response.json(recipe);
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:id", async (request, response, next) => {
    const id = parseId(request.params.id);
    if (id === null) return sendInvalidId(response);
    try {
      if (!(await repository.remove(id))) {
        return response.status(404).json({ error: "recipe_not_found" });
      }
      return response.status(204).send();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
