import { useEffect, useState } from "react";
import * as api from "../api.js";
import { RecipeForm } from "../components/RecipeForm.jsx";

function sourceLabel(source) {
  if (!source) return "Unknown";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [listStatus, setListStatus] = useState("loading");
  const [listError, setListError] = useState("");
  const [editor, setEditor] = useState(null);
  const [editorStatus, setEditorStatus] = useState("idle");
  const [editorError, setEditorError] = useState("");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const [saveFieldErrors, setSaveFieldErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteStatus, setDeleteStatus] = useState("idle");
  const [deleteError, setDeleteError] = useState("");
  const [message, setMessage] = useState("");

  async function loadRecipes() {
    setListStatus("loading");
    setListError("");
    try {
      const savedRecipes = await api.listRecipes();
      setRecipes(savedRecipes);
      setListStatus("ready");
      return true;
    } catch (error) {
      setListStatus("error");
      setListError(error.message);
      return false;
    }
  }

  useEffect(() => {
    loadRecipes();
  }, []);

  function beginCreate() {
    setMessage("");
    setEditorError("");
    setSaveError("");
    setSaveFieldErrors({});
    setEditor({ mode: "create", recipe: { source: "manual" } });
    setEditorStatus("ready");
  }

  async function beginEdit(recipe) {
    setMessage("");
    setEditorError("");
    setSaveError("");
    setSaveFieldErrors({});
    setEditor({ mode: "edit", recipe: null, id: recipe.id, name: recipe.name });
    setEditorStatus("loading");
    try {
      const fullRecipe = await api.getRecipe(recipe.id);
      setEditor({ mode: "edit", recipe: fullRecipe, id: recipe.id, name: recipe.name });
      setEditorStatus("ready");
    } catch (error) {
      setEditorStatus("error");
      setEditorError(error.message);
    }
  }

  function closeEditor() {
    setEditor(null);
    setEditorStatus("idle");
    setEditorError("");
    setSaveError("");
    setSaveFieldErrors({});
  }

  async function saveRecipe(recipe) {
    if (saveStatus === "loading") return;
    setSaveStatus("loading");
    setSaveError("");
    setSaveFieldErrors({});
    try {
      if (editor.mode === "edit") {
        await api.updateRecipe(editor.id, recipe);
      } else {
        await api.createRecipe(recipe);
      }
      const editing = editor.mode === "edit";
      closeEditor();
      setMessage(editing ? "Recipe updated." : "Recipe saved.");
      await loadRecipes();
    } catch (error) {
      setSaveStatus("idle");
      setSaveError(error.message);
      setSaveFieldErrors(error.fields ?? {});
      return;
    }
    setSaveStatus("idle");
  }

  function clearSaveFieldError(field) {
    setSaveFieldErrors((current) => {
      const next = { ...current };
      delete next.body;
      for (const key of Object.keys(next)) {
        if (key === field || key.startsWith(`${field}.`)) delete next[key];
      }
      return next;
    });
  }

  function beginDelete(recipe) {
    setMessage("");
    setDeleteTarget(recipe);
    setDeleteStatus("confirm");
    setDeleteError("");
  }

  function cancelDelete() {
    setDeleteTarget(null);
    setDeleteStatus("idle");
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteStatus === "loading") return;
    setDeleteStatus("loading");
    setDeleteError("");
    try {
      await api.deleteRecipe(deleteTarget.id);
      const deletedName = deleteTarget.name;
      cancelDelete();
      setMessage(`${deletedName} deleted.`);
      await loadRecipes();
    } catch (error) {
      setDeleteStatus("error");
      setDeleteError(error.message);
    }
  }

  return (
    <section aria-labelledby="my-recipes-heading">
      <h1 id="my-recipes-heading">My Recipes</h1>
      <button type="button" onClick={beginCreate}>Add Recipe</button>

      {message ? <p role="status">{message}</p> : null}
      {listStatus === "loading" ? <p role="status">Loading saved recipes…</p> : null}
      {listStatus === "error" ? (
        <div role="alert">
          <p>We couldn&apos;t load your recipes. {listError}</p>
          <button type="button" onClick={loadRecipes}>Retry loading recipes</button>
        </div>
      ) : null}

      {editor ? (
        <section aria-labelledby="recipe-editor-heading">
          <h2 id="recipe-editor-heading">
            {editor.mode === "edit" ? `Edit ${editor.name}` : "Add a recipe"}
          </h2>
          {editorStatus === "loading" ? <p role="status">Loading recipe…</p> : null}
          {editorStatus === "error" ? (
            <div role="alert">
              <p>We couldn&apos;t load this recipe. {editorError}</p>
              <button type="button" onClick={() => beginEdit({ id: editor.id, name: editor.name })}>
                Retry loading recipe
              </button>
            </div>
          ) : null}
          {editorStatus === "ready" ? (
            <>
              <RecipeForm
                key={`${editor.mode}-${editor.id ?? "new"}`}
                initialRecipe={editor.recipe ?? { source: "manual" }}
                submitLabel={editor.mode === "edit" ? "Save Changes" : "Save Recipe"}
                onSubmit={saveRecipe}
                onCancel={closeEditor}
                fieldErrors={saveFieldErrors}
                onFieldChange={clearSaveFieldError}
              />
              {saveStatus === "loading" ? <p role="status">Saving recipe…</p> : null}
              {saveError ? <p role="alert">We couldn&apos;t save this recipe. {saveError}</p> : null}
            </>
          ) : null}
        </section>
      ) : null}

      {listStatus === "ready" && recipes.length === 0 ? <p>No saved recipes yet.</p> : null}
      {listStatus === "ready" && recipes.length > 0 ? (
        <ul aria-label="Saved recipes">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <article aria-labelledby={`recipe-summary-${recipe.id}`}>
                <h2 id={`recipe-summary-${recipe.id}`}>{recipe.name}</h2>
                <p>Source: {sourceLabel(recipe.source)}</p>
                <p>
                  Viewed {recipe.viewCount ?? 0} time{(recipe.viewCount ?? 0) === 1 ? "" : "s"}
                </p>
                <button type="button" onClick={() => beginEdit(recipe)}>
                  Edit {recipe.name}
                </button>
                <button type="button" onClick={() => beginDelete(recipe)}>
                  Delete {recipe.name}
                </button>
              </article>
            </li>
          ))}
        </ul>
      ) : null}

      {deleteTarget ? (
        <section aria-labelledby="delete-confirmation-heading" role="dialog">
          <h2 id="delete-confirmation-heading">Delete {deleteTarget.name}?</h2>
          <p>This cannot be undone.</p>
          {deleteError ? (
            <div role="alert">
              <p>We couldn&apos;t delete this recipe. {deleteError}</p>
              <button type="button" onClick={confirmDelete}>Retry delete</button>
            </div>
          ) : null}
          {deleteStatus !== "error" ? (
            <button type="button" onClick={confirmDelete} disabled={deleteStatus === "loading"}>
              Yes, delete
            </button>
          ) : null}
          <button type="button" onClick={cancelDelete}>Cancel</button>
        </section>
      ) : null}
    </section>
  );
}
