import { useEffect, useState } from "react";
import * as api from "../api.js";
import { RecipeForm } from "../components/RecipeForm.jsx";
import { userFacingError } from "../error-messages.js";

function sourceLabel(source) {
  if (!source) return "Unknown";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function scopeLabel(scope) {
  if (!scope) return "Personal";
  return scope.charAt(0).toUpperCase() + scope.slice(1);
}

export function SharedRecipesPage({ canManage = false }) {
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
      const sharedRecipes = await api.listSharedRecipes();
      setRecipes(sharedRecipes);
      setListStatus("ready");
      return true;
    } catch (error) {
      setListStatus("error");
      setListError(userFacingError(error));
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
    setEditor({ mode: "create", recipe: { source: "manual", scope: "shared" } });
    setEditorStatus("ready");
  }

  function beginEdit(recipe) {
    setMessage("");
    setEditorError("");
    setSaveError("");
    setSaveFieldErrors({});
    setEditor({ mode: "edit", recipe, id: recipe.id, name: recipe.name });
    setEditorStatus("ready");
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
        await api.updateSharedRecipe(editor.id, recipe);
      } else {
        await api.createSharedRecipe(recipe);
      }
      const editing = editor.mode === "edit";
      closeEditor();
      setMessage(editing ? "Shared recipe updated." : "Shared recipe saved.");
      await loadRecipes();
    } catch (error) {
      setSaveStatus("idle");
      setSaveError(userFacingError(error));
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
      await api.deleteSharedRecipe(deleteTarget.id);
      const deletedName = deleteTarget.name;
      cancelDelete();
      setMessage(`${deletedName} deleted from shared recipes.`);
      await loadRecipes();
    } catch (error) {
      setDeleteStatus("error");
      setDeleteError(userFacingError(error));
    }
  }

  return (
    <section aria-labelledby="shared-recipes-heading">
      <h1 id="shared-recipes-heading">Shared Recipes</h1>
      {canManage ? (
        <button type="button" onClick={beginCreate}>Add Shared Recipe</button>
      ) : null}

      {message ? <p role="status">{message}</p> : null}
      {listStatus === "loading" ? <p role="status">Loading shared recipes…</p> : null}
      {listStatus === "error" ? (
        <div role="alert">
          <p>We couldn&apos;t load shared recipes. {listError}</p>
          <button type="button" onClick={loadRecipes}>Retry loading shared recipes</button>
        </div>
      ) : null}

      {canManage && editor ? (
        <section aria-labelledby="shared-recipe-editor-heading">
          <h2 id="shared-recipe-editor-heading">
            {editor.mode === "edit" ? `Edit ${editor.name}` : "Add a shared recipe"}
          </h2>
          {editorStatus === "error" ? (
            <div role="alert">
              <p>We couldn&apos;t load this recipe. {editorError}</p>
              <button type="button" onClick={() => beginEdit(editor.recipe)}>Retry loading recipe</button>
            </div>
          ) : null}
          {editorStatus === "ready" ? (
            <>
              <RecipeForm
                key={`${editor.mode}-${editor.id ?? "new"}`}
                initialRecipe={editor.recipe ?? { source: "manual", scope: "shared" }}
                submitLabel={editor.mode === "edit" ? "Save Changes" : "Save Shared Recipe"}
                onSubmit={saveRecipe}
                onCancel={closeEditor}
                fieldErrors={saveFieldErrors}
                onFieldChange={clearSaveFieldError}
              />
              {saveStatus === "loading" ? <p role="status">Saving shared recipe…</p> : null}
              {saveError ? <p role="alert">We couldn&apos;t save this shared recipe. {saveError}</p> : null}
            </>
          ) : null}
        </section>
      ) : null}

      {listStatus === "ready" && recipes.length === 0 ? <p>No shared recipes yet.</p> : null}
      {listStatus === "ready" && recipes.length > 0 ? (
        <ul aria-label="Shared recipes">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <article aria-labelledby={`shared-recipe-summary-${recipe.id}`}>
                <h2 id={`shared-recipe-summary-${recipe.id}`}>{recipe.name}</h2>
                <p>Source: {sourceLabel(recipe.source)}</p>
                <p>Scope: {scopeLabel(recipe.scope)}</p>
                <p>
                  Viewed {recipe.viewCount ?? 0} time{(recipe.viewCount ?? 0) === 1 ? "" : "s"}
                </p>
                {canManage ? (
                  <>
                    <button
                      type="button"
                      aria-label={`Edit ${recipe.name}`}
                      onClick={() => beginEdit(recipe)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${recipe.name}`}
                      onClick={() => beginDelete(recipe)}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      ) : null}

      {canManage && deleteTarget ? (
        <section aria-labelledby="shared-delete-confirmation-heading" role="dialog">
          <h2 id="shared-delete-confirmation-heading">Delete {deleteTarget.name}?</h2>
          <p>This cannot be undone.</p>
          {deleteError ? (
            <div role="alert">
              <p>We couldn&apos;t delete this shared recipe. {deleteError}</p>
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
