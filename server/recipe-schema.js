import { z } from "zod";

export const recipeInputSchema = z.object({
  name: z.string().trim().min(1),
  prepMinutes: z.number().int().nonnegative(),
  cookMinutes: z.number().int().nonnegative(),
  servings: z.number().int().positive(),
  notes: z.string().trim().default(""),
  source: z.enum(["starter", "manual", "ai"]),
  ingredients: z.array(
    z.object({
      quantity: z.string().trim().min(1),
      name: z.string().trim().min(1)
    })
  ).min(1),
  instructions: z.array(z.string().trim().min(1)).min(1)
});
