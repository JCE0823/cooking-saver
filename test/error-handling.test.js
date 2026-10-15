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
    const databaseError = new Error("PG_CONSTRAINT: private details");
    const repository = {
      getByIdAndRecordView: vi.fn().mockRejectedValue(databaseError)
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await request(createApp({ repository })).get("/api/recipes/1");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "internal_server_error" });
    expect(response.text).not.toContain(databaseError.message);
    expect(log).toHaveBeenCalledWith(databaseError);
  });
});
