# PS3 Part B: Google Sign-In and Per-User Recipes

## Purpose

Part B replaces Cooking Saver's shared Basic Auth login with Google sign-in and server-enforced per-user authorization. Signed-in users can search the shared collection and maintain private personal collections. A configured owner can manage shared recipes. Neon remains the database, while the existing Render API service becomes a same-origin full-stack service that serves both the React application and the API.

Part B does not enable paid AI generation, add additional identity providers, or redesign unrelated PS2 features.

## Authentication and Sessions

The frontend uses Google Identity Services to obtain a Google identity credential. It sends that credential once to a backend authentication endpoint. The backend verifies the credential with Google's supported server library, requires the configured Google client ID as the audience, and uses Google's stable subject identifier as the external account key.

After verification, the backend creates or updates the local user and creates a seven-day session. The browser receives only a random session token in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie scoped to `/`. The database stores a one-way hash of that token, never the raw token. Production frontend and API requests share one origin. Development CORS allows credentials only from the configured local frontend origin.

Signing out revokes the session and clears the cookie. Expired, revoked, unknown, or malformed sessions receive `401`. The frontend returns to the sign-in screen with a useful message. Google credentials, raw session tokens, passwords, authorization headers, and database URLs never appear in logs or API responses.

## Roles

Render receives an `OWNER_EMAIL` setting. A verified Google account whose normalized email matches it is the owner. All other verified accounts are normal users. Owner status is decided by the backend; the frontend only renders capabilities reported by the backend.

The owner can create, edit, and delete shared recipes. Normal users cannot mutate shared recipes. Every signed-in user can view and search shared recipes and can manage only their own personal recipes.

## Data Model and Migration

Add a `users` table containing a local ID, unique Google subject, normalized email, display name, optional profile image URL, and timestamps.

Add a `sessions` table containing a hashed token, user ID, expiration time, optional revocation time, and timestamps. Expired or revoked sessions are invalid and may be removed during normal maintenance.

Add an optional `owner_user_id` foreign key to recipes. A null owner identifies a shared recipe; a non-null owner identifies a personal recipe. The migration preserves every existing recipe and marks it shared. The ten starter recipes remain shared and the existing idempotent seed continues to avoid duplicates.

Saving a shared recipe creates a separate personal copy with a new recipe ID and the current user's owner ID. Changes to the copy never affect the shared original. Personal recipes remain intact if the shared original later changes or is removed.

## API Boundaries

Add authentication endpoints to verify a Google credential, report the current session user, and sign out. Replace Basic Auth middleware with session authentication on protected routes.

Recipe reads return shared recipes plus the current user's personal recipes where appropriate. The personal collection endpoint returns only the current user's recipes. Mutations always derive identity from the verified session; they never accept a user ID or role from the client.

Shared mutations require owner status. Personal update and delete operations require the recipe's `owner_user_id` to match the session user. Attempts to access another user's personal recipe return `404` so the API does not reveal that the recipe exists. Authenticated users save a shared recipe through a dedicated copy operation.

Request logs retain only method, path, status, and timing. Authentication and database errors use the existing safe JSON error shapes and do not reveal secrets.

## Interface

Signed-out users see Google sign-in. Signed-in users see their display name, optional profile image, role, and a sign-out action.

Search returns shared recipes and the current user's matching personal recipes, with clear Shared and Personal labels. Shared results provide **Save to My Recipes**. Personal results provide the existing view, edit, and delete actions.

**My Recipes** lists only the current user's personal collection and lets the user add manual recipes. The owner additionally sees **Shared Recipes**, which provides create, edit, and delete controls for shared content. Normal users never see those owner controls, but the backend remains the enforcement boundary.

The interface explains failed Google sign-in, expired sessions, unavailable services, and forbidden shared changes without exposing technical or secret values.

## Deployment Configuration

Render adds non-secret settings for the Google client ID and owner email. This Google identity-token flow requires no Google client secret. Google Cloud lists the exact full-stack production origin and approved local development origin. Neon remains the only database vendor.

The existing Render API service builds the React application and serves `dist` alongside the API. Production requests use relative `/api` paths. The Part A static site remains available as a rollback path during verification and is not removed without separate approval. After the full-stack service is verified, the canonical Cooking Saver URL changes to that service and the static site can redirect to it.

The migration runs before the service begins listening. Deployment continues to wait for GitHub CI checks. Part A Basic Auth settings are removed only after Google sign-in and rollback verification succeed in production.

## Testing and Completion

Automated tests cover Google credential verification, invalid audiences, session creation and hashing, cookie attributes, expiration and revocation, sign-out, owner assignment, shared mutation rules, user isolation, migration preservation, personal-copy behavior, search visibility, and safe logs. Component tests cover signed-out, signed-in, owner, normal-user, expired-session, and error states.

The migration and full application suite run against PostgreSQL in CI. The production build must pass before deployment.

Part B is complete only after the user personally verifies both roles with two Google accounts: the configured owner can manage shared recipes; a normal user can view shared recipes, save a personal copy, manage only that copy, and cannot access another user's personal recipe. Sessions must survive refresh, sign-out must revoke access, existing data must remain present, version metadata must match the deployed commit, and Render logs must show safe request metadata without identity or credential values.
