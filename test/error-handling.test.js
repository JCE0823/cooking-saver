import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../server/app.js";

afterEach(() => vi.restoreAllMocks());

describe("API error handling", () => {
  it("returns JSON for malformed request bodies", async () => {
    const response = await request(createApp())
      .post("/api/generate")
      .set("Content-Type", "application/json")
      .send('{"dishName":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_json" });
    expect(response.headers["content-type"]).toMatch(/application\/json/);
  });

  it("hides unexpected database details behind a generic JSON error", async () => {
    const databaseError = new Error("SQLITE_CONSTRAINT: private details");
    const statement = {
      get: () => { throw databaseError; },
      all: () => [],
      run: () => { throw databaseError; }
    };
    const db = {
      prepare: () => statement,
      transaction: (callback) => callback
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await request(createApp({ db })).get("/api/recipes/1");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "internal_server_error" });
    expect(response.text).not.toContain(databaseError.message);
    expect(log).toHaveBeenCalledWith(databaseError);
  });
});
