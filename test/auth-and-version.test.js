import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../server/app.js";
import { loadConfig } from "../server/config.js";
import { createSessionAuthFixture, withSession } from "./session-auth-fixture.js";

function createTestApp() {
  const fixture = createSessionAuthFixture();
  return createApp({
    allowedOrigins: ["https://frontend.example", "http://localhost:5173"],
    commit: "abc123",
    repository: { list: vi.fn().mockResolvedValue([]) },
    authRepository: fixture.authRepository
  });
}

describe("API authentication and deployment metadata", () => {
  it("protects API routes with session authentication", async () => {
    const app = createTestApp();

    await request(app)
      .get("/api/recipes")
      .expect(401, { error: "authentication_required" });

    await withSession(request(app).get("/api/recipes"))
      .expect(200, []);
  });

  it.each([
    "Bearer token"
  ])("does not accept Authorization credentials %s", async (authorization) => {
    await request(createTestApp())
      .get("/api/recipes")
      .set("Authorization", authorization)
      .expect(401, { error: "authentication_required" });
  });

  it("rejects requests without a valid session cookie", async () => {
    await request(createTestApp())
      .get("/api/recipes")
      .expect(401, { error: "authentication_required" });
  });

  it("rejects malformed session cookies", async () => {
    await request(createTestApp())
      .get("/api/recipes")
      .set("Cookie", "cooking_saver_session=%ZZ")
      .expect(401, { error: "authentication_required" });
  });

  it("leaves version public while protecting health", async () => {
    const app = createTestApp();

    await request(app).get("/api/version").expect(200, { commit: "abc123" });
    await request(app).get("/api/health").expect(401);
  });

  it("logs request metadata without authorization or credential values", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await withSession(request(createTestApp()).get("/api/recipes"))
      .expect(200);

    expect(log).toHaveBeenCalledOnce();
    const entry = log.mock.calls[0][0];
    expect(entry).toEqual({
      method: "GET",
      path: "/api/recipes",
      status: 200,
      durationMs: expect.any(Number)
    });
    expect(JSON.stringify(entry)).not.toContain("test-session-token");
    expect(JSON.stringify(entry)).not.toMatch(/authorization/i);
    log.mockRestore();
  });

  it("allows only configured origins through CORS", async () => {
    const app = createTestApp();

    await request(app)
      .get("/api/version")
      .set("Origin", "https://frontend.example")
      .expect("Access-Control-Allow-Origin", "https://frontend.example")
      .expect(200);

    const rejected = await request(app)
      .get("/api/version")
      .set("Origin", "https://untrusted.example")
      .expect(200);
    expect(rejected.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("validates deployment configuration without exposing values", () => {
    expect(() => loadConfig({ DATABASE_URL: "postgres://private" })).toThrow(
      "GOOGLE_CLIENT_ID, OWNER_EMAIL, FRONTEND_ORIGIN"
    );

    expect(loadConfig({
      DATABASE_URL: "postgres://private",
      GOOGLE_CLIENT_ID: "google-client-id",
      OWNER_EMAIL: " Owner@Example.com ",
      FRONTEND_ORIGIN: "https://frontend.example",
      RENDER_GIT_COMMIT: "abc123",
      PORT: "4312",
      NODE_ENV: "development"
    })).toEqual({
      databaseUrl: "postgres://private",
      googleClientId: "google-client-id",
      ownerEmail: "owner@example.com",
      allowedOrigins: [
        "https://frontend.example",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
      ],
      secureCookies: false,
      commit: "abc123",
      port: 4312
    });

    expect(loadConfig({
      DATABASE_URL: "postgres://private",
      GOOGLE_CLIENT_ID: "google-client-id",
      OWNER_EMAIL: "owner@example.com",
      FRONTEND_ORIGIN: "https://frontend.example",
      NODE_ENV: "production"
    }).allowedOrigins).toEqual(["https://frontend.example"]);

    expect(() => loadConfig({
      DATABASE_URL: "postgres://private",
      GOOGLE_CLIENT_ID: "google-client-id",
      OWNER_EMAIL: "owner@example.com",
      FRONTEND_ORIGIN: " , "
    })).toThrow("FRONTEND_ORIGIN must contain at least one origin");
  });
});
