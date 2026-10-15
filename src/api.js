const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

let credentials;

export function setCredentials({ username, password }) {
  credentials = { username, password };
}

export function clearCredentials() {
  credentials = undefined;
}

function authorizationHeader() {
  if (!credentials) return undefined;
  return `Basic ${globalThis.btoa(`${credentials.username}:${credentials.password}`)}`;
}

async function requestJSON(path, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers
  };
  const authorization = authorizationHeader();
  if (authorization) headers.Authorization = authorization;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
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

export async function verifyCredentials(username, password) {
  setCredentials({ username, password });
  try {
    return await listRecipes();
  } catch (error) {
    clearCredentials();
    throw error;
  }
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
