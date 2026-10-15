const LOCAL_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

function required(env, name, missing) {
  const value = env[name];
  if (typeof value !== "string" || value.trim() === "") {
    missing.push(name);
  }
  return value;
}

export function loadConfig(env = process.env) {
  const missing = [];
  const databaseUrl = required(env, "DATABASE_URL", missing);
  const username = required(env, "BASIC_AUTH_USERNAME", missing);
  const password = required(env, "BASIC_AUTH_PASSWORD", missing);
  const frontendOrigin = required(env, "FRONTEND_ORIGIN", missing);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const configuredOrigins = frontendOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configuredOrigins.length === 0) {
    throw new Error("FRONTEND_ORIGIN must contain at least one origin");
  }
  const allowedOrigins = [...new Set([...configuredOrigins, ...LOCAL_ORIGINS])];

  const port = env.PORT === undefined || env.PORT === "" ? 3000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("PORT must be an integer between 0 and 65535");
  }

  return {
    databaseUrl: databaseUrl.trim(),
    username,
    password,
    allowedOrigins,
    commit: env.RENDER_GIT_COMMIT?.trim() || "local",
    port
  };
}
