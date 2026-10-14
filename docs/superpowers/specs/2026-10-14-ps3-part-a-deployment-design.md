# Cooking Saver PS3 Part A Deployment Design

## Scope

Part A copies the submitted PS2 Cooking Saver into its own repository and deploys it publicly. The existing `ps2-web-app/` submission remains unchanged. This phase focuses on reliable deployment, persistent production data, and the required shared HTTP Basic Auth. It does not redesign the interface, enable paid AI generation, or implement Google sign-in and user roles. Those belong to later phases after Part A works.

The repository begins private and becomes public only after its complete history passes a secret scan and the app is ready for the class showcase.

## Hosting architecture

- A Render Static Site hosts the Vite-built React frontend.
- A Render Web Service runs the Express backend.
- Neon hosts the production PostgreSQL database.
- GitHub Actions runs tests and the production build on pull requests and pushes to `main`.
- Both Render services use `After CI Checks Pass`, so a failed or missing check does not deploy.
- The frontend and backend deploy from the same `cooking-saver` repository.

The frontend and backend remain separate deployable services while using one application host. Neon keeps data outside Render's temporary filesystem, so recipes survive restarts and redeployments.

## Application structure

The copied project keeps the existing focused layout:

- `src/` contains the React pages, components, and API client.
- `server/` contains Express setup, route handlers, validation, authentication, and database access.
- `server/migrations/` contains ordered PostgreSQL schema migrations.
- `server/seeds/` contains the idempotent starter-recipe seed.
- `test/` contains frontend, API, authentication, database, and persistence tests.
- `.github/workflows/ci.yml` defines the deployment gate.
- `DEPLOY.md` records the required URLs, protected path, hosts, setting names, and later authorization levels without containing secret values.

## Authentication

The frontend opens on a shared-password sign-in screen. A visitor enters the Part A username and password, and React verifies them by requesting a protected endpoint. React keeps the credentials only in memory and sends them in the HTTP Basic Auth header on API requests. Refreshing or closing the page signs the visitor out.

Express authentication middleware protects every `/api` route except `GET /api/version`, which PS3 requires to remain public. Missing or incorrect credentials receive `401 Unauthorized` and a `WWW-Authenticate` header. The protected path recorded in `DEPLOY.md` will be `GET /api/recipes`.

The username and password exist only as `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD` in the Render Web Service environment. They never appear in source code, React build settings, GitHub, or documentation.

## Database and starter data

PostgreSQL replaces the local SQLite file. The relational structure keeps recipes separate from their ordered ingredients and instructions. Migrations create and evolve the schema without dropping production rows.

The production seed inserts these ten recipes:

1. Spaghetti aglio e olio
2. Chicken fried rice
3. Beef tacos
4. Tomato soup
5. Chickpea curry
6. Baked salmon
7. Vegetable stir-fry
8. Chicken noodle soup
9. Pancakes
10. Chocolate chip cookies

Each recipe includes servings, preparation time, ingredients, and ordered instructions. Stable seed identifiers and conflict-safe inserts make seeding idempotent, so repeated deployment never duplicates a recipe. Test recipes and other local data are not copied to production.

Migrations and the seed run before the backend begins accepting requests. `DATABASE_URL` points local development to a local test or development database and production to a dedicated Neon database.

## Recipe generation

Part A does not use a paid AI API. Existing starter and saved recipes continue to work. When a search does not find a recipe, the backend returns a structured response explaining that generation is unavailable, and the frontend shows that message without crashing.

The generation service remains isolated behind the backend interface. A later phase can enable it with `OPENAI_API_KEY` in Render without changing the database or exposing the key to the browser.

## Runtime configuration

Backend settings:

- `DATABASE_URL`, set on the Render Web Service
- `BASIC_AUTH_USERNAME`, set on the Render Web Service
- `BASIC_AUTH_PASSWORD`, set on the Render Web Service
- `FRONTEND_ORIGIN`, set on the Render Web Service
- `RENDER_GIT_COMMIT`, supplied automatically by Render
- `PORT`, supplied automatically by Render

Frontend build setting:

- `VITE_API_BASE_URL`, set on the Render Static Site

Local `.env` files are ignored by Git. No secret value is written into `render.yaml`, GitHub Actions, tests, documentation, or chat.

## API and data flow

The browser downloads the public React build from the Render Static Site. After sign-in, React calls the Render Web Service over HTTPS and includes the Basic Auth header. Express validates authentication and request data, then uses the PostgreSQL repository to query Neon. Responses return JSON to React.

`GET /api/version` returns `{ "commit": "<sha>" }` using `RENDER_GIT_COMMIT`, without authentication. CORS accepts only the deployed frontend origin and the local development origin.

## Error handling and data safety

- Authentication failures return 401 without revealing which credential was wrong.
- Invalid recipe input returns 400 with useful field-level messages.
- Missing recipes with generation disabled return a stable, non-crashing response.
- Database outages return 503 to the client and log technical context without connection strings or credentials.
- Migration failure stops backend startup instead of running against a partial schema.
- A failed Render deploy leaves the previous successful version live.
- Neon owns persistent data independently of Render deployments.

## Testing and verification

GitHub Actions starts a temporary PostgreSQL service and runs `npm ci`, the full test suite, and the Vite production build. The tests cover:

- Existing search, recipe display, validation, and persistence behavior
- PostgreSQL migrations and repository operations
- Exactly ten idempotently seeded starter recipes
- Persistence across an Express restart using the same database
- 401 responses for protected routes without valid credentials
- Successful authenticated requests
- Public `/api/version` behavior and commit output
- Disabled-generation behavior
- Allowed and rejected CORS origins
- Frontend sign-in success, rejected credentials, and refresh sign-out behavior

After deployment, verification follows the PS3 instructions:

1. Push a visible change and confirm both Render services deploy the checked commit.
2. Save a recipe, redeploy, and confirm the recipe survives.
3. Request the `Protected:` path without credentials and confirm a 401 response.
4. Compare `/api/version` with the latest commit on `main`.
5. Make a live request and inspect the corresponding Render log entry.

## Deferred work

Part B gets its own Superpowers design and plan after Part A works. The decisions already made for that later phase are Google sign-in and two server-enforced levels: the owner can manage shared recipes, while signed-in users can search shared recipes and keep a personal collection.
