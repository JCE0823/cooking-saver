import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "cooking_saver_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function serializeSessionCookie(token, {
  secure = true,
  maxAge = SESSION_MAX_AGE_SECONDS
} = {}) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
    "SameSite=Lax"
  ].join("; ");
}

function cookieValue(request) {
  const header = request.get("cookie");
  if (typeof header !== "string") return null;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== SESSION_COOKIE) continue;
    const value = part.slice(separator + 1).trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function createSessionAuth({ repository, ownerEmail, now = () => new Date() } = {}) {
  const normalizedOwnerEmail = normalizeEmail(ownerEmail);

  return async function sessionAuth(request, response, next) {
    const token = cookieValue(request);
    if (!token) return response.status(401).json({ error: "authentication_required" });

    try {
      const user = await repository?.findActiveSession(hashSessionToken(token), now());
      if (!user) return response.status(401).json({ error: "authentication_required" });
      request.user = {
        id: Number(user.id),
        email: user.email,
        displayName: user.displayName,
        pictureUrl: user.pictureUrl ?? null,
        role: normalizeEmail(user.email) === normalizedOwnerEmail ? "owner" : "user"
      };
      request.sessionTokenHash = hashSessionToken(token);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function getSessionToken(request) {
  return cookieValue(request);
}
