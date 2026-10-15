import OpenAI from "openai";
import { recipeInputSchema } from "./recipe-schema.js";

export const UMGPT_BASE_URL = "https://api.toolkit.umgpt.umich.edu/v1";

const SYSTEM_PROMPT = `You create recipes for Cooking Saver. Return one JSON object with exactly these fields: name, prepMinutes, cookMinutes, servings, notes, source, ingredients, and instructions.
Quantities belong in each ingredient's quantity field, and ingredient names belong in its name field. Instructions must be short ordered strings. prepMinutes and cookMinutes must be integer minutes. servings must be a positive integer. Use source "ai". Do not add unsupported fields, IDs, timestamps, view counts, or any other fields.`;

function requireConfiguration(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function responseText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
  }
  return "";
}

export function createAiGenerator({ apiKey, model, baseURL = UMGPT_BASE_URL } = {}) {
  const configuredApiKey = requireConfiguration(apiKey, "apiKey");
  const configuredModel = requireConfiguration(model, "model");
  const client = new OpenAI({ apiKey: configuredApiKey, baseURL });

  return async function generateRecipe(dishName) {
    const completion = await client.chat.completions.create({
      model: configuredModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Create a recipe for ${dishName}.` }
      ]
    });

    const content = responseText(completion?.choices?.[0]?.message?.content);
    if (!content) throw new Error("empty generation response");

    const parsed = JSON.parse(content);
    return recipeInputSchema.parse({ ...parsed, source: "ai" });
  };
}
