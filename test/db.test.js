import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../server/db.js";

let db;
afterEach(() => db?.close());

describe("openDatabase", () => {
  it("creates the schema and starter recipes in an empty database", () => {
    db = openDatabase(":memory:");
    const recipes = db.prepare("SELECT name, view_count FROM recipes ORDER BY name").all();
    expect(recipes.length).toBeGreaterThanOrEqual(3);
    expect(recipes.every((recipe) => recipe.view_count === 0)).toBe(true);
  });
});
