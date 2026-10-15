function sourceLabel(source) {
  if (!source) return "Unknown";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export function RecipeCard({ recipe }) {
  const ingredients = recipe.ingredients ?? [];
  const instructions = recipe.instructions ?? [];
  const viewCount = recipe.viewCount ?? 0;

  return (
    <article aria-labelledby="recipe-title">
      <h2 id="recipe-title">{recipe.name}</h2>

      <dl>
        <div>
          <dt>Preparation time</dt>
          <dd>{recipe.prepMinutes} minutes</dd>
        </div>
        <div>
          <dt>Cooking time</dt>
          <dd>{recipe.cookMinutes} minutes</dd>
        </div>
        <div>
          <dt>Servings</dt>
          <dd>{recipe.servings}</dd>
        </div>
      </dl>

      <section aria-labelledby="ingredients-heading">
        <h3 id="ingredients-heading">Ingredients</h3>
        <ul>
          {ingredients.map((ingredient, index) => (
            <li key={`${ingredient.name}-${index}`}>
              {ingredient.quantity} {ingredient.name}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="instructions-heading">
        <h3 id="instructions-heading">Instructions</h3>
        <ol>
          {instructions.map((instruction, index) => (
            <li key={`${instruction}-${index}`}>{instruction}</li>
          ))}
        </ol>
      </section>

      {recipe.notes ? (
        <section aria-labelledby="notes-heading">
          <h3 id="notes-heading">Notes</h3>
          <p>{recipe.notes}</p>
        </section>
      ) : null}

      <p>Source: {sourceLabel(recipe.source)}</p>
      <p>Viewed {viewCount} time{viewCount === 1 ? "" : "s"}</p>
    </article>
  );
}
