# Cooking Saver

Cooking Saver is a React and Express recipe application built for SI 212. It searches a
persistent recipe collection and begins with ten starter recipes.

Run `npm ci`, `npm test`, and `npm run build` to verify the project.

## Local development

1. In an ignored `.env`, configure `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `OWNER_EMAIL`, and
   `FRONTEND_ORIGIN`, and set `NODE_ENV=development`. Then run `npm start` in one terminal.
2. Run `npm run dev` in a second terminal.
3. Open the Vite URL shown in the second terminal. Vite proxies `/api` requests to the Node
   service on `http://localhost:3000`, so no separate API base URL is needed.

Deployment settings, Neon database setup, Google OAuth origins, and Render rollback steps are
documented in [DEPLOY.md](DEPLOY.md).
