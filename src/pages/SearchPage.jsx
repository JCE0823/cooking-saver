import { useRef, useState } from "react";
import * as api from "../api.js";
import { RecipeCard } from "../components/RecipeCard.jsx";
import { RecipeForm } from "../components/RecipeForm.jsx";
import { userFacingError } from "../error-messages.js";

function scopeLabel(scope) {
  if (!scope) return "Personal";
  return scope.charAt(0).toUpperCase() + scope.slice(1);
}

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle");
  const [matches, setMatches] = useState([]);
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState("");
  const [generationStatus, setGenerationStatus] = useState("idle");
  const [generationError, setGenerationError] = useState(null);
  const [previewRecipe, setPreviewRecipe] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const [saveFieldErrors, setSaveFieldErrors] = useState({});
  const [copyStatus, setCopyStatus] = useState("idle");
  const queryRef = useRef(query);
  const searchRequestRef = useRef(0);
  const generationRequestRef = useRef(0);

  async function submitSearch(event) {
    event.preventDefault();
    const requestToken = ++searchRequestRef.current;
    const requestedQuery = query;
    generationRequestRef.current += 1;
    setStatus("loading");
    setError("");
    setRecipe(null);
    setPreviewRecipe(null);
    setGenerationStatus("idle");
    setGenerationError(null);
    setSaveError("");
    setSaveFieldErrors({});
    setCopyStatus("idle");

    try {
      const results = await api.searchRecipes(query);
      if (requestToken !== searchRequestRef.current || requestedQuery !== queryRef.current) return;
      setMatches(results);
      if (results.length === 0) {
        setStatus("not-found");
      } else if (results.length === 1) {
        await openRecipe(results[0].id, requestToken);
      } else {
        setStatus("matches");
      }
    } catch (requestError) {
      if (requestToken !== searchRequestRef.current || requestedQuery !== queryRef.current) return;
      setError(userFacingError(requestError));
      setStatus("error");
    }
  }

  async function openRecipe(id, requestToken = searchRequestRef.current) {
    setStatus("loading");
    setError("");
    setCopyStatus("idle");

    try {
      const openedRecipe = await api.getRecipe(id);
      if (requestToken !== searchRequestRef.current) return;
      setRecipe(openedRecipe);
      setStatus("recipe");
    } catch (requestError) {
      if (requestToken !== searchRequestRef.current) return;
      setError(userFacingError(requestError));
      setStatus("error");
    }
  }

  async function copyRecipe(id) {
    if (copyStatus === "loading") return;
    setCopyStatus("loading");
    try {
      await api.copySharedRecipe(id);
      setCopyStatus("saved");
    } catch {
      setCopyStatus("error");
    }
  }

  async function generatePreview() {
    if (generationStatus === "loading") return;
    const requestToken = ++generationRequestRef.current;
    const requestedQuery = query;
    setGenerationStatus("loading");
    setGenerationError(null);
    setSaveError("");
    setSaveFieldErrors({});

    try {
      const generatedRecipe = await api.generateRecipe(requestedQuery);
      if (requestToken !== generationRequestRef.current || requestedQuery !== queryRef.current) return;
      setPreviewRecipe(generatedRecipe);
      setGenerationStatus("preview");
    } catch (requestError) {
      if (requestToken !== generationRequestRef.current || requestedQuery !== queryRef.current) return;
      setGenerationError(requestError);
      setGenerationStatus("error");
    }
  }

  async function savePreview(reviewedRecipe) {
    if (saveStatus === "loading") return;
    setSaveStatus("loading");
    setSaveError("");
    setSaveFieldErrors({});

    try {
      const savedRecipe = await api.createRecipe(reviewedRecipe);
      setRecipe(savedRecipe);
      setPreviewRecipe(null);
      setGenerationStatus("idle");
      setSaveStatus("idle");
      setStatus("recipe");
    } catch (requestError) {
      setSaveStatus("idle");
      setSaveError(userFacingError(requestError));
      setSaveFieldErrors(requestError.fields ?? {});
    }
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

  function discardPreview() {
    setPreviewRecipe(null);
    setGenerationStatus("idle");
    setGenerationError(null);
    setSaveError("");
    setSaveFieldErrors({});
    setSaveStatus("idle");
    setStatus("not-found");
  }

  return (
    <section aria-labelledby="search-heading">
      <h1 id="search-heading">Search recipes</h1>
      <form onSubmit={submitSearch}>
        <label htmlFor="dish-name">Dish name</label>
        <input
          id="dish-name"
          name="dishName"
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            queryRef.current = nextQuery;
            setQuery(nextQuery);
          }}
          type="search"
        />
        <button type="submit">Search</button>
      </form>

      {status === "idle" ? <p>Search your saved recipes by dish name.</p> : null}
      {status === "loading" ? <p role="status">Loading…</p> : null}

      {status === "matches" ? (
        <section aria-labelledby="matches-heading">
          <h2 id="matches-heading">Matching recipes</h2>
          <ul>
            {matches.map((match) => (
              <li key={match.id}>
                <button type="button" onClick={() => openRecipe(match.id)}>
                  {match.name}
                </button>
                <span className="scope-label">Scope: {scopeLabel(match.scope)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {status === "recipe" && recipe ? (
        <RecipeCard recipe={recipe} onCopy={copyRecipe} copyStatus={copyStatus} />
      ) : null}

      {status === "not-found" ? (
        <section aria-labelledby="not-found-heading">
          <h2 id="not-found-heading">No saved recipes matched “{query}”.</h2>
          {generationStatus === "idle" || generationStatus === "loading" ? (
            <button
              type="button"
              onClick={generatePreview}
              disabled={generationStatus === "loading"}
            >
              Generate recipe for “{query}”
            </button>
          ) : null}
          {generationStatus === "loading" ? (
            <p role="status">Generating a recipe preview…</p>
          ) : null}
          {generationStatus === "error" ? (
            <div role="alert">
              {generationError?.code === "generation_unavailable" ? (
                <>
                  <p>Recipe generation is unavailable. Ask an administrator to configure the AI service.</p>
                  <button type="button" onClick={generatePreview}>Retry generation</button>
                </>
              ) : (
                <>
                  <p>We couldn’t generate a recipe right now. Please try again.</p>
                  <button type="button" onClick={generatePreview}>Retry generation</button>
                </>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {generationStatus === "preview" && previewRecipe ? (
        <section aria-labelledby="ai-review-heading">
          <h2 id="ai-review-heading">Review this AI-generated recipe</h2>
          <p>
            AI recipes can contain mistakes. Review ingredients, allergy concerns, food-safety guidance,
            and cooking times before saving.
          </p>
          <RecipeForm
            initialRecipe={previewRecipe}
            submitLabel="Save Recipe"
            onSubmit={savePreview}
            onCancel={discardPreview}
            fieldErrors={saveFieldErrors}
            onFieldChange={clearSaveFieldError}
          />
          {saveStatus === "loading" ? <p role="status">Saving recipe…</p> : null}
          {saveError ? <p role="alert">We couldn’t save this recipe. {saveError}</p> : null}
        </section>
      ) : null}

      {status === "error" ? (
        <p role="alert">We couldn’t complete that search. {error}</p>
      ) : null}
    </section>
  );
}
