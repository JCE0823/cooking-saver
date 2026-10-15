import express from "express";
import {
  SESSION_MAX_AGE_SECONDS,
  getSessionToken,
  hashSessionToken,
  newSessionToken,
  serializeSessionCookie,
  createSessionAuth
} from "./session-auth.js";

const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function withRole(user, ownerEmail) {
  return {
    id: Number(user.id),
    email: user.email,
    displayName: user.displayName,
    pictureUrl: user.pictureUrl ?? null,
    role: normalizeEmail(user.email) === normalizeEmail(ownerEmail) ? "owner" : "user"
  };
}

export function createAuthRouter({
  verifier,
  repository,
  ownerEmail,
  googleClientId,
  secureCookies = true,
  now = () => new Date(),
  randomToken = newSessionToken
} = {}) {
  const router = express.Router();
  const authenticate = createSessionAuth({ repository, ownerEmail, now });

  router.get("/config", (_request, response) => {
    response.json({ googleClientId });
  });

  router.post("/auth/google", async (request, response, next) => {
    const credential = request.body?.credential;
    if (typeof credential !== "string" || credential.trim() === "") {
      return response.status(400).json({ error: "invalid_google_credential" });
    }

    try {
      const verified = await verifier.verify(credential);
      const user = await repository.upsertGoogleUser(verified);
      const token = randomToken();
      if (typeof token !== "string" || token.length === 0) {
        throw new Error("session token generation failed");
      }
      await repository.createSession({
        tokenHash: hashSessionToken(token),
        userId: user.id,
        expiresAt: new Date(now().getTime() + SESSION_MAX_AGE_MS)
      });
      response.set("Set-Cookie", serializeSessionCookie(token, { secure: secureCookies }));
      return response.json({ user: withRole(user, ownerEmail) });
    } catch (error) {
      if (error?.code === "invalid_google_credential") {
        return response.status(401).json({ error: "invalid_google_credential" });
      }
      return next(error);
    }
  });

  router.get("/auth/session", authenticate, (request, response) => {
    response.json({ user: request.user });
  });

  router.post("/auth/sign-out", authenticate, async (request, response, next) => {
    try {
      await repository.revokeSession(request.sessionTokenHash, now());
      response.set("Set-Cookie", serializeSessionCookie("", {
        secure: secureCookies,
        maxAge: 0
      }));
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export { getSessionToken };
