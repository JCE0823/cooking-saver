import { useState } from "react";

const emptyRecipe = {
  name: "",
  prepMinutes: 0,
  cookMinutes: 0,
  servings: 1,
  notes: "",
  source: "manual",
  ingredients: [{ quantity: "", name: "" }],
  instructions: [""]
};

function formValue(recipe) {
  return {
    ...emptyRecipe,
    ...recipe,
    ingredients: recipe?.ingredients?.length
      ? recipe.ingredients.map((ingredient) => ({ ...ingredient }))
      : [{ quantity: "", name: "" }],
    instructions: recipe?.instructions?.length ? [...recipe.instructions] : [""]
  };
}

function messagesFor(fieldErrors, field) {
  const value = fieldErrors?.[field];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function fieldLabel(field) {
  const labels = {
    name: "Name",
    prepMinutes: "Prep minutes",
    cookMinutes: "Cook minutes",
    servings: "Servings",
    notes: "Notes"
  };
  if (labels[field]) return labels[field];
  const ingredient = field.match(/^ingredients\.(\d+)\.(quantity|name)$/);
  if (ingredient) {
    return `Ingredient ${Number(ingredient[1]) + 1} ${ingredient[2]}`;
  }
  const instruction = field.match(/^instructions\.(\d+)$/);
  if (instruction) return `Step ${Number(instruction[1]) + 1} instruction`;
  return field;
}

function fieldId(field) {
  const ingredient = field.match(/^ingredients\.(\d+)\.(quantity|name)$/);
  if (ingredient) return `ingredient-${ingredient[2]}-${ingredient[1]}`;
  const instruction = field.match(/^instructions\.(\d+)$/);
  if (instruction) return `instruction-${instruction[1]}`;
  return {
    name: "recipe-name",
    prepMinutes: "prep-minutes",
    cookMinutes: "cook-minutes",
    servings: "servings",
    notes: "notes"
  }[field];
}

function FieldError({ id, messages }) {
  if (!messages.length) return null;
  return <p id={id} className="field-error">{messages.join(" ")}</p>;
}

export function RecipeForm({
  initialRecipe,
  submitLabel = "Save Recipe",
  onSubmit,
  onCancel,
  fieldErrors,
  errors,
  onFieldChange
}) {
  const [recipe, setRecipe] = useState(() => formValue(initialRecipe));
  const visibleFieldErrors = fieldErrors ?? errors ?? {};
  const errorEntries = Object.entries(visibleFieldErrors).flatMap(([field, value]) => {
    const messages = Array.isArray(value) ? value : [value];
    return messages.length ? [{ field, messages }] : [];
  });

  function updateField(field, value) {
    onFieldChange?.(field);
    setRecipe((current) => ({ ...current, [field]: value }));
  }

  function updateIngredient(index, field, value) {
    onFieldChange?.(`ingredients.${index}.${field}`);
    setRecipe((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, ingredientIndex) =>
        ingredientIndex === index ? { ...ingredient, [field]: value } : ingredient
      )
    }));
  }

  function updateInstruction(index, value) {
    onFieldChange?.(`instructions.${index}`);
    setRecipe((current) => ({
      ...current,
      instructions: current.instructions.map((instruction, instructionIndex) =>
        instructionIndex === index ? value : instruction
      )
    }));
  }

  function addIngredient() {
    setRecipe((current) => ({
      ...current,
      ingredients: [...current.ingredients, { quantity: "", name: "" }]
    }));
  }

  function removeIngredient(index) {
    onFieldChange?.("ingredients");
    setRecipe((current) => {
      if (current.ingredients.length <= 1) return current;
      return {
        ...current,
        ingredients: current.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index)
      };
    });
  }

  function addInstruction() {
    setRecipe((current) => ({
      ...current,
      instructions: [...current.instructions, ""]
    }));
  }

  function removeInstruction(index) {
    onFieldChange?.("instructions");
    setRecipe((current) => {
      if (current.instructions.length <= 1) return current;
      return {
        ...current,
        instructions: current.instructions.filter((_, instructionIndex) => instructionIndex !== index)
      };
    });
  }

  function submit(event) {
    event.preventDefault();
    onSubmit({
      name: recipe.name,
      prepMinutes: Number(recipe.prepMinutes),
      cookMinutes: Number(recipe.cookMinutes),
      servings: Number(recipe.servings),
      notes: recipe.notes,
      source: recipe.source,
      ingredients: recipe.ingredients.map((ingredient) => ({
        quantity: ingredient.quantity,
        name: ingredient.name
      })),
      instructions: [...recipe.instructions]
    });
  }

  return (
    <form onSubmit={submit}>
      {errorEntries.length ? (
        <div role="alert" aria-labelledby="recipe-form-errors-heading" className="error-summary">
          <h3 id="recipe-form-errors-heading">Please correct the following errors</h3>
          <ul>
            {errorEntries.map(({ field, messages }) => (
              <li key={field}>
                {fieldId(field) ? (
                  <a href={`#${fieldId(field)}`}>
                    {fieldLabel(field)}: {messages.join(" ")}
                  </a>
                ) : (
                  <span>{fieldLabel(field)}: {messages.join(" ")}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <label htmlFor="recipe-name">Name</label>
      <input
        id="recipe-name"
        name="name"
        value={recipe.name}
        onChange={(event) => updateField("name", event.target.value)}
        aria-invalid={messagesFor(visibleFieldErrors, "name").length > 0}
        aria-describedby={messagesFor(visibleFieldErrors, "name").length ? "recipe-name-error" : undefined}
        required
      />
      <FieldError id="recipe-name-error" messages={messagesFor(visibleFieldErrors, "name")} />

      <label htmlFor="prep-minutes">Prep minutes</label>
      <input
        id="prep-minutes"
        name="prepMinutes"
        type="number"
        min="0"
        value={recipe.prepMinutes}
        onChange={(event) => updateField("prepMinutes", event.target.value)}
        aria-invalid={messagesFor(visibleFieldErrors, "prepMinutes").length > 0}
        aria-describedby={messagesFor(visibleFieldErrors, "prepMinutes").length ? "prep-minutes-error" : undefined}
        required
      />
      <FieldError id="prep-minutes-error" messages={messagesFor(visibleFieldErrors, "prepMinutes")} />

      <label htmlFor="cook-minutes">Cook minutes</label>
      <input
        id="cook-minutes"
        name="cookMinutes"
        type="number"
        min="0"
        value={recipe.cookMinutes}
        onChange={(event) => updateField("cookMinutes", event.target.value)}
        aria-invalid={messagesFor(visibleFieldErrors, "cookMinutes").length > 0}
        aria-describedby={messagesFor(visibleFieldErrors, "cookMinutes").length ? "cook-minutes-error" : undefined}
        required
      />
      <FieldError id="cook-minutes-error" messages={messagesFor(visibleFieldErrors, "cookMinutes")} />

      <label htmlFor="servings">Servings</label>
      <input
        id="servings"
        name="servings"
        type="number"
        min="1"
        value={recipe.servings}
        onChange={(event) => updateField("servings", event.target.value)}
        aria-invalid={messagesFor(visibleFieldErrors, "servings").length > 0}
        aria-describedby={messagesFor(visibleFieldErrors, "servings").length ? "servings-error" : undefined}
        required
      />
      <FieldError id="servings-error" messages={messagesFor(visibleFieldErrors, "servings")} />

      <label htmlFor="notes">Notes</label>
      <textarea
        id="notes"
        name="notes"
        value={recipe.notes}
        onChange={(event) => updateField("notes", event.target.value)}
        aria-invalid={messagesFor(visibleFieldErrors, "notes").length > 0}
        aria-describedby={messagesFor(visibleFieldErrors, "notes").length ? "notes-error" : undefined}
      />
      <FieldError id="notes-error" messages={messagesFor(visibleFieldErrors, "notes")} />

      <fieldset>
        <legend>Ingredients</legend>
        {recipe.ingredients.map((ingredient, index) => (
          <div key={`ingredient-${index}`}>
            <label htmlFor={`ingredient-quantity-${index}`}>
              Ingredient {index + 1} quantity
            </label>
            <input
              id={`ingredient-quantity-${index}`}
              value={ingredient.quantity}
              onChange={(event) => updateIngredient(index, "quantity", event.target.value)}
              aria-invalid={messagesFor(visibleFieldErrors, `ingredients.${index}.quantity`).length > 0}
              aria-describedby={messagesFor(visibleFieldErrors, `ingredients.${index}.quantity`).length ? `ingredient-quantity-${index}-error` : undefined}
              required
            />
            <FieldError
              id={`ingredient-quantity-${index}-error`}
              messages={messagesFor(visibleFieldErrors, `ingredients.${index}.quantity`)}
            />
            <label htmlFor={`ingredient-name-${index}`}>
              Ingredient {index + 1} name
            </label>
            <input
              id={`ingredient-name-${index}`}
              value={ingredient.name}
              onChange={(event) => updateIngredient(index, "name", event.target.value)}
              aria-invalid={messagesFor(visibleFieldErrors, `ingredients.${index}.name`).length > 0}
              aria-describedby={messagesFor(visibleFieldErrors, `ingredients.${index}.name`).length ? `ingredient-name-${index}-error` : undefined}
              required
            />
            <FieldError
              id={`ingredient-name-${index}-error`}
              messages={messagesFor(visibleFieldErrors, `ingredients.${index}.name`)}
            />
            <button
              type="button"
              onClick={() => removeIngredient(index)}
              disabled={recipe.ingredients.length <= 1}
            >
              Remove Ingredient
            </button>
          </div>
        ))}
        <button type="button" onClick={addIngredient}>Add Ingredient</button>
      </fieldset>

      <fieldset>
        <legend>Instructions</legend>
        {recipe.instructions.map((instruction, index) => (
          <div key={`instruction-${index}`}>
            <label htmlFor={`instruction-${index}`}>Step {index + 1} instruction</label>
            <textarea
              id={`instruction-${index}`}
              value={instruction}
              onChange={(event) => updateInstruction(index, event.target.value)}
              aria-invalid={messagesFor(visibleFieldErrors, `instructions.${index}`).length > 0}
              aria-describedby={messagesFor(visibleFieldErrors, `instructions.${index}`).length ? `instruction-${index}-error` : undefined}
              required
            />
            <FieldError
              id={`instruction-${index}-error`}
              messages={messagesFor(visibleFieldErrors, `instructions.${index}`)}
            />
            <button
              type="button"
              onClick={() => removeInstruction(index)}
              disabled={recipe.instructions.length <= 1}
            >
              Remove Step
            </button>
          </div>
        ))}
        <button type="button" onClick={addInstruction}>Add Step</button>
      </fieldset>

      <button type="submit">{submitLabel}</button>
      {onCancel ? (
        <button type="button" onClick={onCancel}>Discard</button>
      ) : null}
    </form>
  );
}
