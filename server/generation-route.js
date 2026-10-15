import express from "express";
import { z } from "zod";
import { recipeInputSchema } from "./recipe-schema.js";

const generationRequestSchema = z.object({
  dishName: z.string().trim().min(1).max(100)
});

function validationFields(error) {
  const fields = {};
  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "body";
    fields[field] ??= [];
    fields[field].push(issue.message);
  }
  return fields;
}

export function createGenerationRouter({ generateRecipe } = {}) {
  const router = express.Router();

  router.post("/", async (request, response) => {
    const requestResult = generationRequestSchema.safeParse(request.body);
    if (!requestResult.success) {
      return response.status(400).json({
        error: "validation_failed",
        fields: validationFields(requestResult.error)
      });
    }

    if (typeof generateRecipe !== "function") {
      return response.status(503).json({ error: "generation_unavailable" });
    }

    try {
      const generated = await generateRecipe(requestResult.data.dishName);
      const recipe = recipeInputSchema.parse({ ...generated, source: "ai" });
      return response.json(recipe);
    } catch (_error) {
      return response.status(502).json({ error: "generation_failed" });
    }
  });

  return router;
}
