import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../server/app.js";
import { migrateDatabase } from "../server/db.js";
import { createRecipeRepository } from "../server/recipe-repository.js";
import { hashSessionToken } from "../server/session-auth.js";
import { createTestPool } from "./postgres.js";

const recipeInput = {
  name: "Tomato Soup",
  prepMinutes: 10,
  cookMinutes: 25,
  servings: 4,
  notes: "Serve warm.",
  source: "manual",
  ingredients: [{ quantity: "4", name: "tomatoes" }],
  instructions: ["Chop the tomatoes.", "Simmer until tender."]
};

const users = {
  owner: {
    id: 1,
    email: "owner@example.com",
    displayName: "Owner",
    pictureUrl: null
  },
  userOne: {
    id: 2,
    email: "one@example.com",
    displayName: "User One",
    pictureUrl: null
  },
  userTwo: {
    id: 3,
    email: "two@example.com",
    displayName: "User Two",
    pictureUrl: null
  }
};

const tokens = {
  owner: "owner-session-token",
  userOne: "user-one-session-token",
  userTwo: "user-two-session-token"
};

let pool;

afterEach(async () => {
  await pool?.end();
  pool = undefined;
});

async function createTestApp() {
  pool = createTestPool();
  await migrateDatabase(pool);
  for (const user of Object.values(users)) {
    await pool.query(
      `INSERT INTO users (id, google_subject, email, display_name)
       VALUES ($1, $2, $3, $4)`,
      [user.id, `google-${user.id}`, user.email, user.displayName]
    );
  }

  const authRepository = {
    findActiveSession: async (tokenHash) => {
      const entry = Object.entries(tokens).find(([, token]) => hashSessionToken(token) === tokenHash);
      return entry ? users[entry[0]] : null;
    }
  };
  const app = createApp({
    repository: createRecipeRepository(pool),
    authRepository,
    ownerEmail: users.owner.email,
    secureCookies: false
  });
  return app;
}

function asUser(app, user, method, path) {
  return request(app)[method](path)
    .set("Cookie", `cooking_saver_session=${tokens[user]}`);
}

describe("recipe authorization", () => {
  it("isolates personal recipes between users", async () => {
    const app = await createTestApp();
    const created = await asUser(app, "userOne", "post", "/api/recipes")
      .send(recipeInput).expect(201);

    await asUser(app, "userTwo", "get", `/api/recipes/${created.body.id}`).expect(404);
    await asUser(app, "userTwo", "put", `/api/recipes/${created.body.id}`)
      .send(recipeInput).expect(404);
    await asUser(app, "userTwo", "delete", `/api/recipes/${created.body.id}`).expect(404);
  });

  it("copies a shared recipe without changing the original", async () => {
    const app = await createTestApp();
    const shared = await asUser(app, "owner", "post", "/api/shared-recipes")
      .send(recipeInput).expect(201);
    const copied = await asUser(app, "userOne", "post", `/api/recipes/${shared.body.id}/copy`)
      .expect(201);

    expect(copied.body).toMatchObject({ name: recipeInput.name, scope: "personal" });
    expect(copied.body.id).not.toBe(shared.body.id);
    expect(shared.body.scope).toBe("shared");

    await asUser(app, "userOne", "put", `/api/recipes/${copied.body.id}`)
      .send({ ...recipeInput, name: "My Tomato Soup" }).expect(200);
    const original = await asUser(app, "userTwo", "get", `/api/recipes/${shared.body.id}`)
      .expect(200);
    expect(original.body.name).toBe(recipeInput.name);
  });

  it("allows normal users to read shared recipes", async () => {
    const app = await createTestApp();
    await asUser(app, "owner", "post", "/api/shared-recipes")
      .send(recipeInput).expect(201);

    const response = await asUser(app, "userOne", "get", "/api/shared-recipes")
      .expect(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ name: recipeInput.name, scope: "shared" });
  });

  it("keeps a copied recipe after the shared source is deleted", async () => {
    const app = await createTestApp();
    const shared = await asUser(app, "owner", "post", "/api/shared-recipes")
      .send(recipeInput).expect(201);
    const copied = await asUser(app, "userOne", "post", `/api/recipes/${shared.body.id}/copy`)
      .expect(201);

    await asUser(app, "owner", "delete", `/api/shared-recipes/${shared.body.id}`).expect(204);
    const personal = await asUser(app, "userOne", "get", `/api/recipes/${copied.body.id}`)
      .expect(200);
    expect(personal.body).toMatchObject({ id: copied.body.id, name: recipeInput.name, scope: "personal" });
    expect(personal.body.ingredients).toEqual(recipeInput.ingredients);
    expect(personal.body.instructions).toEqual(recipeInput.instructions);
  });

  it("allows only the owner to mutate shared recipes", async () => {
    const app = await createTestApp();
    await asUser(app, "userOne", "post", "/api/shared-recipes")
      .send(recipeInput).expect(403, { error: "owner_required" });
    const shared = await asUser(app, "owner", "post", "/api/shared-recipes")
      .send(recipeInput).expect(201);
    await asUser(app, "userOne", "put", `/api/shared-recipes/${shared.body.id}`)
      .send({ ...recipeInput, name: "Not Allowed" })
      .expect(403, { error: "owner_required" });
    await asUser(app, "userOne", "delete", `/api/shared-recipes/${shared.body.id}`)
      .expect(403, { error: "owner_required" });

    await asUser(app, "owner", "put", `/api/shared-recipes/${shared.body.id}`)
      .send({ ...recipeInput, name: "Owner Updated" }).expect(200);
    await asUser(app, "owner", "delete", `/api/shared-recipes/${shared.body.id}`)
      .expect(204);
  });
});
