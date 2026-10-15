function normalizeId(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : String(value);
}

function mapRecipe(row, ingredients, instructions) {
  if (!row) return null;

  return {
    id: normalizeId(row.id),
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

function mapSearchResult(row) {
  return {
    id: normalizeId(row.id),
    name: row.name,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    servings: row.servings,
    source: row.source,
    viewCount: row.view_count
  };
}

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapedLikeRegExp(value) {
  let expression = "^";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "\\" && index + 1 < value.length) {
      expression += escapeRegExp(value[index + 1]);
      index += 1;
    } else if (character === "%") {
      expression += ".*";
    } else if (character === "_") {
      expression += ".";
    } else {
      expression += escapeRegExp(character);
    }
  }
  return new RegExp(`${expression}$`, "i");
}

async function withTransaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getRecipe(client, id) {
  const recipeResult = await client.query("SELECT * FROM recipes WHERE id = $1", [id]);
  const row = recipeResult.rows[0];
  if (!row) return null;

  const [ingredients, instructions] = await Promise.all([
    client.query(
      "SELECT quantity, name FROM ingredients WHERE recipe_id = $1 ORDER BY position",
      [id]
    ),
    client.query(
      "SELECT text FROM instructions WHERE recipe_id = $1 ORDER BY position",
      [id]
    )
  ]);
  return mapRecipe(row, ingredients.rows, instructions.rows);
}

export function createRecipeRepository(pool) {
  async function getById(id) {
    return getRecipe(pool, id);
  }

  async function list() {
    const result = await pool.query("SELECT * FROM recipes ORDER BY id");
    return Promise.all(result.rows.map((row) => getRecipe(pool, row.id)));
  }

  async function search(query) {
    const rawQuery = String(query ?? "");
    const escapedQuery = escapeLikePattern(rawQuery);
    try {
      const result = await pool.query(
        `SELECT id, name, prep_minutes, cook_minutes, servings, source, view_count
         FROM recipes
         WHERE name ILIKE $1 ESCAPE '\\'
         ORDER BY LOWER(name), id`,
        [`%${escapedQuery}%`]
      );
      return result.rows.map(mapSearchResult);
    } catch (error) {
      if (pool.__cookingSaverTestAdapter !== "pg-mem") throw error;

      const result = await pool.query(
        `SELECT id, name, prep_minutes, cook_minutes, servings, source, view_count
         FROM recipes
         ORDER BY LOWER(name), id`
      );
      const pattern = escapedLikeRegExp(`%${escapedQuery}%`);
      return result.rows.filter((row) => pattern.test(row.name)).map(mapSearchResult);
    }
  }

  async function getByIdAndRecordView(id) {
    return withTransaction(pool, async (client) => {
      const result = await client.query(
        "UPDATE recipes SET view_count = view_count + 1 WHERE id = $1 RETURNING *",
        [id]
      );
      if (result.rows.length === 0) return null;
      return getRecipe(client, id);
    });
  }

  async function create(input) {
    return withTransaction(pool, async (client) => {
      const result = await client.query(
        `INSERT INTO recipes
          (name, prep_minutes, cook_minutes, servings, notes, source)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          input.name,
          input.prepMinutes,
          input.cookMinutes,
          input.servings,
          input.notes,
          input.source
        ]
      );
      const recipeId = result.rows[0].id;
      await insertChildren(client, recipeId, input);
      return getRecipe(client, recipeId);
    });
  }

  async function update(id, input) {
    return withTransaction(pool, async (client) => {
      const result = await client.query(
        `UPDATE recipes
         SET name = $1,
             prep_minutes = $2,
             cook_minutes = $3,
             servings = $4,
             notes = $5,
             source = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING id`,
        [
          input.name,
          input.prepMinutes,
          input.cookMinutes,
          input.servings,
          input.notes,
          input.source,
          id
        ]
      );
      if (result.rows.length === 0) return null;

      await client.query("DELETE FROM ingredients WHERE recipe_id = $1", [id]);
      await client.query("DELETE FROM instructions WHERE recipe_id = $1", [id]);
      await insertChildren(client, id, input);
      return getRecipe(client, id);
    });
  }

  async function remove(id) {
    const result = await pool.query("DELETE FROM recipes WHERE id = $1 RETURNING id", [id]);
    return result.rows.length > 0;
  }

  return { list, getById, getByIdAndRecordView, search, create, update, remove };
}

async function insertChildren(client, recipeId, input) {
  for (const [index, ingredient] of input.ingredients.entries()) {
    await client.query(
      `INSERT INTO ingredients (recipe_id, position, quantity, name)
       VALUES ($1, $2, $3, $4)`,
      [recipeId, index + 1, ingredient.quantity, ingredient.name]
    );
  }

  for (const [index, text] of input.instructions.entries()) {
    await client.query(
      `INSERT INTO instructions (recipe_id, position, text)
       VALUES ($1, $2, $3)`,
      [recipeId, index + 1, text]
    );
  }
}
