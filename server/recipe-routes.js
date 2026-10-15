import express from "express";
import { recipeInputSchema } from "./recipe-schema.js";
import { createRecipeRepository } from "./recipe-repository.js";

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

export function createRecipeRouter({ db }) {
  const router = express.Router();
  const repository = createRecipeRepository(db);

  router.get("/", (_request, response) => {
    response.json(repository.list());
  });

  router.get("/search", (request, response) => {
    response.json(repository.search(request.query.q));
  });

  router.get("/:id", (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) return sendInvalidId(response);
    const recipe = repository.getByIdAndRecordView(id);
    if (!recipe) return response.status(404).json({ error: "recipe_not_found" });
    return response.json(recipe);
  });

  router.post("/", (request, response) => {
    const input = parseRecipeBody(request, response);
    if (!input) return;
    response.status(201).json(repository.create(input));
  });

  router.put("/:id", (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) return sendInvalidId(response);
    const input = parseRecipeBody(request, response);
    if (!input) return;
    const recipe = repository.update(id, input);
    if (!recipe) return response.status(404).json({ error: "recipe_not_found" });
    return response.json(recipe);
  });

  router.delete("/:id", (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) return sendInvalidId(response);
    if (!repository.remove(id)) return response.status(404).json({ error: "recipe_not_found" });
    return response.status(204).send();
  });

  return router;
}
