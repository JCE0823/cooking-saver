async function requestJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

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
