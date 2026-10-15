import Database from "better-sqlite3";

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    prep_minutes INTEGER NOT NULL CHECK (prep_minutes >= 0),
    cook_minutes INTEGER NOT NULL CHECK (cook_minutes >= 0),
    servings INTEGER NOT NULL CHECK (servings > 0),
    notes TEXT,
    source TEXT NOT NULL CHECK (source IN ('starter', 'manual', 'ai')),
    view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position > 0),
    quantity TEXT NOT NULL,
    name TEXT NOT NULL,
    UNIQUE (recipe_id, position)
  );

  CREATE TABLE IF NOT EXISTS instructions (
    id INTEGER PRIMARY KEY,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position > 0),
    text TEXT NOT NULL,
    UNIQUE (recipe_id, position)
  );
`;

const STARTER_RECIPES = [
  {
    name: "Pancakes",
    prepMinutes: 10,
    cookMinutes: 15,
    servings: 4,
    notes: "Serve warm with fruit or maple syrup.",
    ingredients: [
      ["1 1/2 cups", "all-purpose flour"],
      ["3 1/2 teaspoons", "baking powder"],
      ["1 tablespoon", "sugar"],
      ["1 1/4 cups", "milk"],
      ["1 egg", "egg"],
      ["3 tablespoons", "melted butter"],
    ],
    instructions: [
      "Whisk the flour, baking powder, and sugar together in a bowl.",
      "Whisk the milk, egg, and melted butter together, then stir into the dry ingredients until just combined.",
      "Cook portions of batter on a lightly buttered hot griddle until bubbles form, then flip and cook until golden.",
    ],
  },
  {
    name: "Spaghetti Aglio e Olio",
    prepMinutes: 5,
    cookMinutes: 15,
    servings: 4,
    notes: "Add red pepper flakes for gentle heat.",
    ingredients: [
      ["12 ounces", "spaghetti"],
      ["1/3 cup", "olive oil"],
      ["6 cloves", "garlic, thinly sliced"],
      ["1/4 teaspoon", "red pepper flakes"],
      ["1/4 cup", "chopped parsley"],
      ["to taste", "salt"],
    ],
    instructions: [
      "Cook the spaghetti in salted water until al dente, reserving 1/2 cup of the cooking water.",
      "Warm the olive oil in a skillet and cook the garlic and red pepper flakes until the garlic is fragrant and lightly golden.",
      "Toss the drained spaghetti with the garlic oil, adding reserved pasta water as needed, then finish with parsley and salt.",
    ],
  },
  {
    name: "Vegetable Stir-Fry",
    prepMinutes: 15,
    cookMinutes: 10,
    servings: 4,
    notes: "Use any combination of quick-cooking vegetables you have on hand.",
    ingredients: [
      ["2 tablespoons", "vegetable oil"],
      ["2 cups", "broccoli florets"],
      ["1", "bell pepper, sliced"],
      ["1", "carrot, thinly sliced"],
      ["1 cup", "snap peas"],
      ["3 tablespoons", "soy sauce"],
      ["1 teaspoon", "grated ginger"],
    ],
    instructions: [
      "Whisk the soy sauce and ginger together in a small bowl.",
      "Heat the oil in a wok or large skillet over high heat, then stir-fry the vegetables until crisp-tender.",
      "Pour in the sauce and toss for one minute before serving over rice or noodles.",
    ],
  },
];

function seedStarterRecipes(db) {
  const recipeCount = db.prepare("SELECT COUNT(*) AS count FROM recipes").get().count;
  if (recipeCount !== 0) return;

  const insertRecipe = db.prepare(`
    INSERT INTO recipes (name, prep_minutes, cook_minutes, servings, notes, source)
    VALUES (@name, @prepMinutes, @cookMinutes, @servings, @notes, 'starter')
  `);
  const insertIngredient = db.prepare(`
    INSERT INTO ingredients (recipe_id, position, quantity, name)
    VALUES (@recipeId, @position, @quantity, @name)
  `);
  const insertInstruction = db.prepare(`
    INSERT INTO instructions (recipe_id, position, text)
    VALUES (@recipeId, @position, @text)
  `);

  const seed = db.transaction(() => {
    for (const recipe of STARTER_RECIPES) {
      const { lastInsertRowid } = insertRecipe.run(recipe);
      const recipeId = Number(lastInsertRowid);
      recipe.ingredients.forEach(([quantity, name], index) => {
        insertIngredient.run({ recipeId, position: index + 1, quantity, name });
      });
      recipe.instructions.forEach((text, index) => {
        insertInstruction.run({ recipeId, position: index + 1, text });
      });
    }
  });
  seed();
}

export function openDatabase(databasePath) {
  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  seedStarterRecipes(db);
  return db;
}
