async function requestJSON(path, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers
  };

  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers
  });

  if (response.status === 204) return undefined;

  const text = await response.text();
  let payload;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok) {
    const endpoint = path.split("?", 1)[0];
    if (
      response.status === 401
      && endpoint !== "/api/auth/google"
      && endpoint !== "/api/auth/session"
    ) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cooking-saver:unauthorized"));
      }
    }
    const code = payload?.error ?? `http_${response.status}`;
    const error = new Error(`Request failed: ${code}`);
    error.code = code;
    error.status = response.status;
    if (payload?.fields) error.fields = payload.fields;
    throw error;
  }

  return payload;
}

export function searchRecipes(query) {
  return requestJSON(`/api/recipes/search?q=${encodeURIComponent(query)}`);
}

export function listRecipes() {
  return requestJSON("/api/recipes");
}

export const getPublicConfig = () => requestJSON("/api/config");

export const getSession = () => requestJSON("/api/auth/session");

export const signInWithGoogle = (credential) => requestJSON("/api/auth/google", {
  method: "POST",
  body: JSON.stringify({ credential })
});

export const signOut = () => requestJSON("/api/auth/sign-out", { method: "POST" });

export function getRecipe(id) {
  return requestJSON(`/api/recipes/${encodeURIComponent(id)}`);
}

export function generateRecipe(dishName) {
  return requestJSON("/api/generate", {
    method: "POST",
    body: JSON.stringify({ dishName })
  });
}

export function createRecipe(recipe) {
  return requestJSON("/api/recipes", {
    method: "POST",
    body: JSON.stringify(recipe)
  });
}

export function updateRecipe(id, recipe) {
  return requestJSON(`/api/recipes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(recipe)
  });
}

export function deleteRecipe(id) {
  return requestJSON(`/api/recipes/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export const copySharedRecipe = (id) => requestJSON(
  `/api/recipes/${encodeURIComponent(id)}/copy`,
  { method: "POST" }
);

export const listSharedRecipes = () => requestJSON("/api/shared-recipes");

export const createSharedRecipe = (recipe) => requestJSON("/api/shared-recipes", {
  method: "POST",
  body: JSON.stringify(recipe)
});

export const updateSharedRecipe = (id, recipe) => requestJSON(
  `/api/shared-recipes/${encodeURIComponent(id)}`,
  { method: "PUT", body: JSON.stringify(recipe) }
);

export const deleteSharedRecipe = (id) => requestJSON(
  `/api/shared-recipes/${encodeURIComponent(id)}`,
  { method: "DELETE" }
);
