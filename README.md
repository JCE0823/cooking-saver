# Cooking Saver

Cooking Saver is a React and Express recipe application built for SI 212. It searches a persistent recipe collection and begins with ten starter recipes.

Run `npm ci` and `npm test` to verify the project. For local development, run the API and Vite frontend separately:

1. In one terminal, configure `DATABASE_URL`, `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD`, and `FRONTEND_ORIGIN` in an ignored `.env`, then run `npm start`.
2. In a second terminal, set `VITE_API_BASE_URL=http://localhost:3000` and run `npm run dev`.
3. Open the Vite URL shown in the second terminal.

Deployment settings, Neon database setup, and Render service configuration are documented by name only in `DEPLOY.md`.
