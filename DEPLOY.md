App: https://cooking-saver-jce0823.onrender.com
API: https://cooking-saver-api-jce0823.onrender.com
Protected: /api/recipes

# Deployment

The Render Blueprint in `render.yaml` defines the two services for Problem Set 3 Part A:

- `cooking-saver-jce0823` is the static React app. It builds with `npm ci && npm run build`, publishes `dist`, rewrites client-side routes to `index.html`, and receives `VITE_API_BASE_URL` from its Render service settings.
- `cooking-saver-api-jce0823` is the Node/Express API. It builds with `npm ci`, starts with `npm start`, and checks `/api/version` for health. Its persistent PostgreSQL database is hosted by Neon, not Render.

Both services use `autoDeployTrigger: checksPass`, so Render deploys only after the repository checks pass. The GitHub Actions workflow at `.github/workflows/ci.yml` runs on pull requests and pushes to `main` with Node 22 and a disposable PostgreSQL 17 service. It exports `TEST_DATABASE_URL` for the restart-persistence test, then runs `npm ci`, `npm test`, and `npm run build`.

## Render settings

Create or update the services by applying the repository `render.yaml` Blueprint. Enter the following settings in the Render dashboard for the API service; these names are intentionally listed without secret values:

- `DATABASE_URL` — the Neon PostgreSQL connection string entered directly in the Render Web Service API settings.
- `BASIC_AUTH_USERNAME` — the Part A shared username.
- `BASIC_AUTH_PASSWORD` — the Part A shared password.
- `FRONTEND_ORIGIN` — supplied by `render.yaml` as the deployed app origin used by API CORS.

The static app service gets `VITE_API_BASE_URL` from the Blueprint. React receives only that API base URL; database credentials and authentication secrets stay on the API service.

Paid AI generation remains disabled in the deployed Part A services: no `UMGPT_API_KEY` or `UMGPT_MODEL` settings are configured in the Blueprint.

## Access model

Part A protects `/api/recipes` with one shared username and password configured through the API service settings. Use the same shared credentials when exercising the deployed app and API. Do not commit those values or place them in this document.

Part B replaces the shared-password access model with user roles. When Part B is implemented, follow its role and identity configuration and remove the Part A shared-password assumption from the user-facing access flow.

## Local configuration

For local API work, configure the environment names consumed by `server/config.js`: `DATABASE_URL`, `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD`, `FRONTEND_ORIGIN`, and optionally `PORT` and `RENDER_GIT_COMMIT`. Keep local secret values in an ignored `.env` file. The CI-only `TEST_DATABASE_URL` is disposable and is supplied by GitHub Actions; it must not fall back to production `DATABASE_URL`.

Run the full local stack from two terminals. In the first terminal, set the API variables above and run `npm start` (the API listens on port 3000 by default). In the second terminal, set `VITE_API_BASE_URL=http://localhost:3000` and run `npm run dev`; then open the Vite URL it prints. Do not put real credentials in this document or in the repository.
