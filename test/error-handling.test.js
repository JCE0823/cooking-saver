import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../server/app.js";

const auth = { username: "student", password: "correct horse battery staple" };

afterEach(() => vi.restoreAllMocks());

describe("API error handling", () => {
  it("returns JSON for malformed request bodies", async () => {
    const response = await request(createApp({ auth }))
      .post("/api/generate")
      .auth(auth.username, auth.password)
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

    const response = await request(createApp({ repository, auth })).get("/api/recipes/1")
      .auth(auth.username, auth.password);

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
    "ENETUNREACH"
  ])("reports %s database connection failures as unavailable", async (code) => {
    const databaseError = Object.assign(new Error("private connection details"), { code });
    const repository = {
      getByIdAndRecordView: vi.fn().mockRejectedValue(databaseError)
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await request(createApp({ repository, auth })).get("/api/recipes/1")
      .auth(auth.username, auth.password);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "database_unavailable" });
    expect(log).toHaveBeenCalledWith({
      name: databaseError.name,
      code: databaseError.code,
      stack: databaseError.stack
    });
  });
});
