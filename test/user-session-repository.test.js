import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "../server/db.js";
import { createUserSessionRepository } from "../server/user-session-repository.js";
import { createTestPool } from "./postgres.js";

let pool;

afterEach(async () => {
  await pool?.end();
  pool = undefined;
});

async function setupRepository() {
  pool = createTestPool();
  await migrateDatabase(pool);
  return createUserSessionRepository(pool);
}

describe("user and session repository", () => {
  it("upserts a Google user without changing its local id", async () => {
    const repository = await setupRepository();
    const first = await repository.upsertGoogleUser({
      googleSubject: "google-123",
      email: "owner@example.com",
      displayName: "Owner One",
      pictureUrl: "https://example.test/one.png"
    });
    const second = await repository.upsertGoogleUser({
      googleSubject: "google-123",
      email: "owner@example.com",
      displayName: "Owner Updated",
      pictureUrl: null
    });

    expect(second).toEqual({
      id: first.id,
      email: "owner@example.com",
      displayName: "Owner Updated",
      pictureUrl: null
    });
  });

  it("returns only active, unrevoked sessions", async () => {
    const repository = await setupRepository();
    const user = await repository.upsertGoogleUser({
      googleSubject: "google-456",
      email: "user@example.com",
      displayName: "Normal User",
      pictureUrl: null
    });
    await repository.createSession({
      tokenHash: "active-hash",
      userId: user.id,
      expiresAt: new Date("2030-01-08T00:00:00Z")
    });

    await expect(repository.findActiveSession(
      "active-hash",
      new Date("2030-01-01T00:00:00Z")
    )).resolves.toEqual(user);
    await repository.revokeSession("active-hash", new Date("2030-01-02T00:00:00Z"));
    await expect(repository.findActiveSession(
      "active-hash",
      new Date("2030-01-03T00:00:00Z")
    )).resolves.toBeNull();
  });
});
