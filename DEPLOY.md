App: https://cooking-saver-api-jce0823.onrender.com
Protected: /api/recipes

# Deployment

The Node service is the production app URL. It builds the React client, serves `dist`, handles
client-side routes, and serves the API from the same origin. The legacy static service remains in
`render.yaml` as retained infrastructure during production verification; it is not a functional
rollback for this relative-API full-stack release and should not be treated as one.

Both services use `autoDeployTrigger: checksPass`, so Render deploys only after the repository
checks pass. The Node health check is `/api/version`. The persistent PostgreSQL database is hosted
by Neon, not Render.

## Render settings

Apply the repository `render.yaml` Blueprint. Enter these settings in the Node service's Render
dashboard without committing their values:

- `DATABASE_URL` — the Neon PostgreSQL connection string.
- `GOOGLE_CLIENT_ID` — the Google OAuth client ID.
- `OWNER_EMAIL` — the Google account that receives owner permissions.
- `FRONTEND_ORIGIN` — the browser frontend origin shown at the top of this document (the origin
  from which browsers load React and send credentialed API requests).

Add the production app origin to the Google OAuth client's authorized JavaScript origins. For local
development, add `http://localhost:5173` as an authorized JavaScript origin as well. The production
app and API use the same origin, so React calls relative `/api` paths. No AI credentials belong in
the Blueprint.

## Local development

Keep local values in an ignored `.env` file. Configure `DATABASE_URL`, `GOOGLE_CLIENT_ID`,
`OWNER_EMAIL`, and `FRONTEND_ORIGIN` (use the browser frontend origin, normally
`http://localhost:5173` with Vite), and add
`NODE_ENV=development`, with optional `PORT` and `RENDER_GIT_COMMIT`. This dotenv setting is
Windows-friendly and makes the session cookie usable over local HTTP; production keeps the
default secure-cookie behavior by omitting it.

Run the full local stack from two terminals:

1. Run `npm start` to start Node on port 3000.
2. Run `npm run dev` to start Vite. Its `/api` proxy forwards requests to `http://localhost:3000`.
3. Open the Vite URL it prints.

## Rollback

If the full-stack service fails production verification, redeploy the last known-good Part A
deployment/commit of the full-stack Node service in Render. That is the supported rollback because
it restores the previously verified application and API together. The static service is retained
legacy infrastructure until production verification is complete; it auto-deploys the current
repository source and therefore is not a safe application rollback target. Do not delete the
database or rotate credentials as part of a routine rollback.
