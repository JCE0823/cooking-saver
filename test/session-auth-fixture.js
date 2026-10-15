import { hashSessionToken } from "../server/session-auth.js";

export const TEST_SESSION_TOKEN = "test-session-token";
export const TEST_SESSION_COOKIE = `cooking_saver_session=${TEST_SESSION_TOKEN}`;

export function createSessionAuthFixture({ user = {} } = {}) {
  const sessionUser = {
    id: 1,
    email: "student@example.com",
    displayName: "Test User",
    pictureUrl: null,
    ...user
  };

  return {
    authRepository: {
      findActiveSession: async () => sessionUser,
      revokeSession: async () => true
    },
    cookie: TEST_SESSION_COOKIE,
    user: sessionUser
  };
}

export async function seedTestUser(pool, user = {}) {
  const sessionUser = {
    id: 1,
    email: "student@example.com",
    displayName: "Test User",
    pictureUrl: null,
    ...user
  };
  await pool.query(
    `INSERT INTO users (id, google_subject, email, display_name, picture_url)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      sessionUser.id,
      `test-google-${sessionUser.id}`,
      sessionUser.email,
      sessionUser.displayName,
      sessionUser.pictureUrl
    ]
  );
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [hashSessionToken(TEST_SESSION_TOKEN), sessionUser.id, new Date(Date.now() + 60 * 60 * 1000)]
  );
  return sessionUser;
}

export function withSession(request, cookie = TEST_SESSION_COOKIE) {
  return request.set("Cookie", cookie);
}
