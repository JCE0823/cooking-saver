import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../server/app.js";
import { createGoogleVerifier } from "../server/google-verifier.js";
import { migrateDatabase } from "../server/db.js";
import { newSessionToken } from "../server/session-auth.js";
import { createUserSessionRepository } from "../server/user-session-repository.js";
import { createTestPool } from "./postgres.js";

let pool;

afterEach(async () => {
  await pool?.end();
  pool = undefined;
});

function createVerifier() {
  return {
    verify: vi.fn().mockResolvedValue({
      googleSubject: "google-owner",
      email: "owner@example.com",
      displayName: "Project Owner",
      pictureUrl: null
    })
  };
}

async function setup({ secureCookies = true } = {}) {
  pool = createTestPool();
  await migrateDatabase(pool);
  const verifier = createVerifier();
  const app = createApp({
    authRepository: createUserSessionRepository(pool),
    verifier,
    ownerEmail: "OWNER@example.com",
    googleClientId: "client-123",
    secureCookies,
    now: () => new Date("2030-01-01T00:00:00.000Z"),
    randomToken: () => "fixed-session-token"
  });
  return { app, verifier };
}

describe("Google authentication", () => {
  it("creates a 32-byte random session token representation", () => {
    const token = newSessionToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("exposes only the public Google client configuration", async () => {
    const { app } = await setup();
    await request(app).get("/api/config").expect(200, { googleClientId: "client-123" });
  });

  it("creates an owner session with a secure cookie", async () => {
    const { app } = await setup();

    const response = await request(app)
      .post("/api/auth/google")
      .send({ credential: "verified-google-credential" })
      .expect(200);

    expect(response.body.user).toEqual({
      id: expect.any(Number),
      email: "owner@example.com",
      displayName: "Project Owner",
      pictureUrl: null,
      role: "owner"
    });
    expect(response.headers["set-cookie"][0]).toMatch(
      /^cooking_saver_session=[^;]+; Max-Age=604800; Path=\/; HttpOnly; Secure; SameSite=Lax$/
    );
    const stored = await pool.query("SELECT token_hash FROM sessions");
    expect(stored.rows[0].token_hash).not.toContain("fixed-session-token");
  });

  it("rejects an invalid Google credential", async () => {
    const { app, verifier } = await setup();
    verifier.verify.mockRejectedValue(Object.assign(new Error("invalid"), {
      code: "invalid_google_credential"
    }));

    await request(app)
      .post("/api/auth/google")
      .send({ credential: "bad" })
      .expect(401, { error: "invalid_google_credential" });
  });

  it("restores and revokes a session", async () => {
    const { app } = await setup({ secureCookies: false });
    const agent = request.agent(app);
    await agent.post("/api/auth/google")
      .send({ credential: "verified-google-credential" })
      .expect(200);
    await agent.get("/api/auth/session").expect(200);
    await agent.post("/api/auth/sign-out").expect(204);
    await agent.get("/api/auth/session")
      .expect(401, { error: "authentication_required" });
  });

  it("clears the cookie and records revocation on sign-out", async () => {
    const { app } = await setup({ secureCookies: false });
    const agent = request.agent(app);
    await agent.post("/api/auth/google")
      .send({ credential: "verified-google-credential" })
      .expect(200);

    const response = await agent.post("/api/auth/sign-out").expect(204);
    expect(response.headers["set-cookie"][0]).toMatch(
      /^cooking_saver_session=; Max-Age=0; Path=\/; HttpOnly; SameSite=Lax$/
    );
    const stored = await pool.query("SELECT revoked_at FROM sessions");
    expect(stored.rows[0].revoked_at).not.toBeNull();
  });

  it("rejects an expired session", async () => {
    const { app } = await setup({ secureCookies: false });
    const agent = request.agent(app);
    await agent.post("/api/auth/google")
      .send({ credential: "verified-google-credential" })
      .expect(200);
    await pool.query(
      "UPDATE sessions SET expires_at = $1",
      [new Date("2029-12-31T23:59:59.000Z")]
    );

    await agent.get("/api/auth/session")
      .expect(401, { error: "authentication_required" });
  });

  it("verifies the configured audience and normalizes verified claims", async () => {
    const client = {
      verifyIdToken: vi.fn().mockResolvedValue({
        getPayload: () => ({
          sub: "subject-1",
          email: " Owner@Example.COM ",
          email_verified: true,
          name: " Project Owner ",
          picture: "https://example.test/avatar"
        })
      })
    };
    const verifier = createGoogleVerifier({ clientId: "client-123", client });

    await expect(verifier.verify("credential")).resolves.toEqual({
      googleSubject: "subject-1",
      email: "owner@example.com",
      displayName: "Project Owner",
      pictureUrl: "https://example.test/avatar"
    });
    expect(client.verifyIdToken).toHaveBeenCalledWith({
      idToken: "credential",
      audience: "client-123"
    });
  });
});
