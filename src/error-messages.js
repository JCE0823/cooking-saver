const ERROR_MESSAGES = {
  authentication_required: "Your session expired. Please sign in again.",
  database_unavailable: "The recipe service is temporarily unavailable. Please try again.",
  generation_unavailable: "Recipe generation is unavailable. Ask an administrator to configure the AI service.",
  generation_failed: "We couldn’t generate a recipe right now. Please try again.",
  internal_server_error: "Something went wrong. Please try again.",
  invalid_google_credential: "Google sign-in could not be verified. Please try again.",
  owner_required: "Only the owner can manage shared recipes.",
  recipe_not_found: "That recipe is no longer available.",
  request_failed: "We couldn’t complete that request. Please try again.",
  validation_failed: "Please correct the highlighted fields."
};

export function userFacingError(error, fallback = "Something went wrong. Please try again.") {
  const code = typeof error?.code === "string" ? error.code : "";
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (error?.status === 401) return ERROR_MESSAGES.authentication_required;
  if (error?.status === 403) return ERROR_MESSAGES.owner_required;
  if (error?.status === 404) return ERROR_MESSAGES.recipe_not_found;
  if (error?.status >= 500) return ERROR_MESSAGES.internal_server_error;
  if (error instanceof TypeError || code === "network_error") {
    return "We couldn’t connect to Cooking Saver. Please try again.";
  }
  return fallback;
}
