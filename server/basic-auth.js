import { timingSafeEqual } from "node:crypto";

function constantTimeEqual(actual, expected) {
  const expectedBuffer = Buffer.from(String(expected ?? ""), "utf8");
  const actualBuffer = Buffer.from(String(actual ?? ""), "utf8");
  const candidate = Buffer.alloc(expectedBuffer.length);
  actualBuffer.copy(candidate, 0, 0, Math.min(actualBuffer.length, candidate.length));
  return timingSafeEqual(candidate, expectedBuffer) && actualBuffer.length === expectedBuffer.length;
}

function decodeCredentials(header) {
  if (typeof header !== "string" || !header.startsWith("Basic ")) return null;
  const encoded = header.slice("Basic ".length).trim();
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
    return null;
  }

  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return null;
  return {
    username: decoded.slice(0, separator),
    password: decoded.slice(separator + 1)
  };
}

export function createBasicAuth({ username, password } = {}) {
  return (request, response, next) => {
    const credentials = decodeCredentials(request.get("authorization"));
    const candidateUsername = credentials?.username ?? "";
    const candidatePassword = credentials?.password ?? "";
    const usernameValid = constantTimeEqual(candidateUsername, username);
    const passwordValid = constantTimeEqual(candidatePassword, password);
    const valid = usernameValid && passwordValid && credentials !== null;

    if (!valid) {
      response.set("WWW-Authenticate", 'Basic realm="Cooking Saver"');
      return response.status(401).json({ error: "authentication_required" });
    }
    return next();
  };
}
