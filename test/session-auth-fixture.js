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

export function withSession(request, cookie = TEST_SESSION_COOKIE) {
  return request.set("Cookie", cookie);
}
