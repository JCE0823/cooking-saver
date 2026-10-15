import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../server/app.js";
import { createSessionAuthFixture, withSession } from "./session-auth-fixture.js";

afterEach(() => vi.restoreAllMocks());

describe("API error handling", () => {
  it("returns JSON for malformed request bodies", async () => {
    const response = await withSession(request(createApp({
      authRepository: createSessionAuthFixture().authRepository
    })).post("/api/generate"))
      .set("Content-Type", "application/json")
      .send('{"dishName":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_json" });
    expect(response.headers["content-type"]).toMatch(/application\/json/);
  });

  it("hides unexpected database details behind a generic JSON error", async () => {
    const databaseError = new Error("PG_CONSTRAINT: private details");
    const repository = {
      getByIdAndRecordView: vi.fn().mockRejectedValue(databaseError)
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const fixture = createSessionAuthFixture();

    const response = await withSession(request(createApp({ repository, authRepository: fixture.authRepository }))
      .get("/api/recipes/1"));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "internal_server_error" });
    expect(response.text).not.toContain(databaseError.message);
    expect(log).toHaveBeenCalledWith({
      name: databaseError.name,
      code: databaseError.code,
      stack: databaseError.stack
    });
  });

  it.each([
    "ECONNREFUSED",
    "EAI_AGAIN",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "ETIMEDOUT"
  ])("reports %s database connection failures as unavailable", async (code) => {
    const databaseError = Object.assign(new Error("private connection details"), { code });
    const repository = {
      getByIdAndRecordView: vi.fn().mockRejectedValue(databaseError)
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const fixture = createSessionAuthFixture();

    const response = await withSession(request(createApp({ repository, authRepository: fixture.authRepository }))
      .get("/api/recipes/1"));

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "database_unavailable" });
    expect(log).toHaveBeenCalledWith({
      name: databaseError.name,
      code: databaseError.code,
      stack: databaseError.stack
    });
  });
});
