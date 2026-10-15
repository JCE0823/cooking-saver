import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../server/app.js";
import { loadConfig } from "../server/config.js";

const credentials = {
  username: "student",
  password: "correct horse battery staple"
};

function createTestApp() {
  return createApp({
    auth: credentials,
    allowedOrigins: ["https://frontend.example", "http://localhost:5173"],
    commit: "abc123",
    repository: { list: vi.fn().mockResolvedValue([]) }
  });
}

describe("API authentication and deployment metadata", () => {
  it("protects API routes with shared Basic Auth", async () => {
    const app = createTestApp();

    await request(app)
      .get("/api/recipes")
      .expect("WWW-Authenticate", 'Basic realm="Cooking Saver"')
      .expect(401, { error: "authentication_required" });

    await request(app)
      .get("/api/recipes")
      .auth(credentials.username, credentials.password)
      .expect(200, []);
  });

  it.each([
    "Basic not-base64",
    "Bearer token",
    "Basic "
  ])("rejects malformed authorization %s", async (authorization) => {
    await request(createTestApp())
      .get("/api/recipes")
      .set("Authorization", authorization)
      .expect("WWW-Authenticate", 'Basic realm="Cooking Saver"')
      .expect(401, { error: "authentication_required" });
  });

  it("rejects wrong credentials", async () => {
    await request(createTestApp())
      .get("/api/recipes")
      .auth(credentials.username, "wrong password")
      .expect(401, { error: "authentication_required" });
  });

  it("leaves version public while protecting health", async () => {
    const app = createTestApp();

    await request(app).get("/api/version").expect(200, { commit: "abc123" });
    await request(app).get("/api/health").expect(401);
  });

  it("logs request metadata without authorization or credential values", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await request(createTestApp())
      .get("/api/recipes")
      .auth(credentials.username, credentials.password)
      .expect(200);

    expect(log).toHaveBeenCalledOnce();
    const entry = log.mock.calls[0][0];
    expect(entry).toEqual({
      method: "GET",
      path: "/api/recipes",
      status: 200,
      durationMs: expect.any(Number)
    });
    expect(JSON.stringify(entry)).not.toContain(credentials.username);
    expect(JSON.stringify(entry)).not.toContain(credentials.password);
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
      "BASIC_AUTH_USERNAME, BASIC_AUTH_PASSWORD, FRONTEND_ORIGIN"
    );

    expect(loadConfig({
      DATABASE_URL: "postgres://private",
      BASIC_AUTH_USERNAME: credentials.username,
      BASIC_AUTH_PASSWORD: credentials.password,
      FRONTEND_ORIGIN: "https://frontend.example",
      RENDER_GIT_COMMIT: "abc123",
      PORT: "4312"
    })).toEqual({
      databaseUrl: "postgres://private",
      username: credentials.username,
      password: credentials.password,
      allowedOrigins: [
        "https://frontend.example",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
      ],
      commit: "abc123",
      port: 4312
    });

    expect(() => loadConfig({
      DATABASE_URL: "postgres://private",
      BASIC_AUTH_USERNAME: credentials.username,
      BASIC_AUTH_PASSWORD: credentials.password,
      FRONTEND_ORIGIN: " , "
    })).toThrow("FRONTEND_ORIGIN must contain at least one origin");
  });
});
