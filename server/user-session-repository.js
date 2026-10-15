function mapUser(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    email: row.email,
    displayName: row.display_name,
    pictureUrl: row.picture_url ?? null
  };
}

export function createUserSessionRepository(pool) {
  async function upsertGoogleUser({ googleSubject, email, displayName, pictureUrl }) {
    const result = await pool.query(
      `INSERT INTO users (google_subject, email, display_name, picture_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_subject) DO UPDATE
       SET email = EXCLUDED.email,
           display_name = EXCLUDED.display_name,
           picture_url = EXCLUDED.picture_url,
           updated_at = CURRENT_TIMESTAMP
       RETURNING id, email, display_name, picture_url`,
      [googleSubject, email, displayName, pictureUrl]
    );
    return mapUser(result.rows[0]);
  }

  async function createSession({ tokenHash, userId, expiresAt }) {
    const result = await pool.query(
      `INSERT INTO sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [tokenHash, userId, expiresAt]
    );
    return Number(result.rows[0].id);
  }

  async function findActiveSession(tokenHash, now) {
    const result = await pool.query(
      `SELECT u.id, u.email, u.display_name, u.picture_url
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > $2`,
      [tokenHash, now]
    );
    return mapUser(result.rows[0]);
  }

  async function revokeSession(tokenHash, now) {
    const result = await pool.query(
      `UPDATE sessions
       SET revoked_at = $2
       WHERE token_hash = $1
         AND revoked_at IS NULL
       RETURNING id`,
      [tokenHash, now]
    );
    return result.rows.length > 0;
  }

  return { upsertGoogleUser, createSession, findActiveSession, revokeSession };
}
