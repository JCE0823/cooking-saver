function mapRecipe(row, ingredients, instructions) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    servings: row.servings,
    notes: row.notes ?? "",
    source: row.source,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ingredients: ingredients.map((ingredient) => ({
      quantity: ingredient.quantity,
      name: ingredient.name
    })),
    instructions: instructions.map((instruction) => instruction.text)
  };
}

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function createRecipeRepository(db) {
  const findRecipe = db.prepare("SELECT * FROM recipes WHERE id = ?");
  const findIngredients = db.prepare(
    "SELECT quantity, name FROM ingredients WHERE recipe_id = ? ORDER BY position"
  );
  const findInstructions = db.prepare(
    "SELECT text FROM instructions WHERE recipe_id = ? ORDER BY position"
  );
  const findAllRecipes = db.prepare("SELECT * FROM recipes ORDER BY id");
  const findSearchResults = db.prepare(`
    SELECT id, name, prep_minutes, cook_minutes, servings, source, view_count
    FROM recipes
    WHERE name LIKE ? ESCAPE '\\' COLLATE NOCASE
    ORDER BY name COLLATE NOCASE, id
  `);
  const insertRecipe = db.prepare(`
    INSERT INTO recipes (name, prep_minutes, cook_minutes, servings, notes, source)
    VALUES (@name, @prepMinutes, @cookMinutes, @servings, @notes, @source)
  `);
  const insertIngredient = db.prepare(`
    INSERT INTO ingredients (recipe_id, position, quantity, name)
    VALUES (@recipeId, @position, @quantity, @name)
  `);
  const insertInstruction = db.prepare(`
    INSERT INTO instructions (recipe_id, position, text)
    VALUES (@recipeId, @position, @text)
  `);
  const updateRecipe = db.prepare(`
    UPDATE recipes
    SET name = @name,
        prep_minutes = @prepMinutes,
        cook_minutes = @cookMinutes,
        servings = @servings,
        notes = @notes,
        source = @source,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);
  const deleteIngredients = db.prepare("DELETE FROM ingredients WHERE recipe_id = ?");
  const deleteInstructions = db.prepare("DELETE FROM instructions WHERE recipe_id = ?");
  const deleteRecipe = db.prepare("DELETE FROM recipes WHERE id = ?");

  function getById(id) {
    const row = findRecipe.get(id);
    if (!row) return null;
    return mapRecipe(row, findIngredients.all(id), findInstructions.all(id));
  }

  function list() {
    return findAllRecipes.all().map((row) =>
      mapRecipe(row, findIngredients.all(row.id), findInstructions.all(row.id))
    );
  }

  function search(query) {
    const escapedQuery = escapeLikePattern(String(query ?? ""));
    const pattern = `%${escapedQuery}%`;
    return findSearchResults.all(pattern).map((row) => ({
      id: row.id,
      name: row.name,
      prepMinutes: row.prep_minutes,
      cookMinutes: row.cook_minutes,
      servings: row.servings,
      source: row.source,
      viewCount: row.view_count
    }));
  }

  const getByIdAndRecordView = db.transaction((id) => {
    const changed = db.prepare(
      "UPDATE recipes SET view_count = view_count + 1 WHERE id = ?"
    ).run(id).changes;
    return changed === 0 ? null : getById(id);
  });

  const create = db.transaction((input) => {
    const result = insertRecipe.run(input);
    const recipeId = Number(result.lastInsertRowid);
    input.ingredients.forEach((ingredient, index) => {
      insertIngredient.run({
        recipeId,
        position: index + 1,
        quantity: ingredient.quantity,
        name: ingredient.name
      });
    });
    input.instructions.forEach((text, index) => {
      insertInstruction.run({ recipeId, position: index + 1, text });
    });
    return getById(recipeId);
  });

  const update = db.transaction((id, input) => {
    if (!findRecipe.get(id)) return null;
    updateRecipe.run({ ...input, id });
    deleteIngredients.run(id);
    deleteInstructions.run(id);
    input.ingredients.forEach((ingredient, index) => {
      insertIngredient.run({
        recipeId: id,
        position: index + 1,
        quantity: ingredient.quantity,
        name: ingredient.name
      });
    });
    input.instructions.forEach((text, index) => {
      insertInstruction.run({ recipeId: id, position: index + 1, text });
    });
    return getById(id);
  });

  const remove = db.transaction((id) => deleteRecipe.run(id).changes > 0);

  return { list, getById, getByIdAndRecordView, search, create, update, remove };
}
