# Final Part B Review Fixes

## Status

Implemented and committed as `5701b07` (`fix: close final Part B review findings`). No external
deployment, push, credential, or environment changes were made.

## Findings addressed

- CI now builds `dist` before the PostgreSQL-backed test run, so restart-persistence SPA assertions
  are deterministic in a fresh checkout.
- The Render static service remains in `render.yaml`, but deployment documentation now explicitly
  treats it as retained legacy infrastructure rather than a functional rollback. Rollback is a
  redeploy of the last known-good Part A full-stack Node deployment/commit.
- `copyShared` locks the shared parent row with `FOR SHARE` for the transaction's scalar and child
  snapshot. A real-Postgres-only concurrency test verifies an update cannot interleave with the
  copy; the copied recipe remains internally consistent.
- Shared recipe reads are available to signed-in normal users while shared mutations remain owner-
  only. The frontend maps known API codes/statuses to safe human-readable messages on Recipes,
  Shared Recipes, and Search pages without exposing raw API error text.
- Added focused coverage for expired and malformed sessions, sign-out cookie clearing and session
  revocation, normal-user shared reads, and copied recipes surviving source deletion.
- Production CORS defaults now include only configured origins; localhost defaults are development-
  only.
- Deployment documentation now defines `FRONTEND_ORIGIN` as the browser frontend origin and lists
  `http://localhost:5173` as a local Google authorized JavaScript origin.
- Concurrent startup seeding now takes the same PostgreSQL advisory lock as migrations for the
  duration of the seed transaction. A real-Postgres-only concurrent seeding test verifies one
  complete installation. pg-mem skips advisory-lock coverage because it does not implement locks.

## Verification

- Focused regression suite: `9 passed`, `1 skipped`; `56 passed`, `2 skipped`.
- Full suite: `17 passed`, `2 skipped`; `81 passed`, `5 skipped`.
- Production build: `npm.cmd run build` passed.
- Diff check: `git diff --check` passed.

The two real-Postgres-only test files are skipped locally when `TEST_DATABASE_URL` is absent; CI's
PostgreSQL service exercises them.
