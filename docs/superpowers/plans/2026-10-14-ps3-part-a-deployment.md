# Cooking Saver PS3 Part A Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the PS2 Cooking Saver as a public React frontend and authenticated Express API backed by persistent Neon PostgreSQL, with tests gating every Render deployment.

**Architecture:** One repository produces a Render Static Site and a Render Web Service. The backend uses an asynchronous PostgreSQL repository, applies idempotent migrations and starter data before listening, protects API routes with HTTP Basic Auth, and exposes one public version endpoint. GitHub Actions verifies the app against PostgreSQL before Render deploys either service.

**Tech Stack:** Node.js 22, React, Vite, Express, Zod, PostgreSQL (`pg`), Neon, Vitest, Testing Library, Supertest, GitHub Actions, Render Blueprints

**Spec:** `docs/superpowers/specs/2026-10-14-ps3-part-a-deployment-design.md`

## Global Constraints

- Leave `assignments/ps2-web-app/` unchanged; copy it into this repository.
- Keep this repository private until its complete history passes a secret scan.
- Never put secret values in files, Git history, tests, task briefs, review packages, or chat.
- The user enters `DATABASE_URL`, `BASIC_AUTH_USERNAME`, and `BASIC_AUTH_PASSWORD` directly into host settings.
- React receives only `VITE_API_BASE_URL`.
- Protect every `/api` route except `GET /api/version`.
- Seed exactly the ten recipes named in the spec, idempotently.
- Paid AI generation stays disabled; Google OAuth and roles belong to Part B.
- Run migrations before listening, and stop startup if a migration fails.
- Both Render services use `autoDeployTrigger: checksPass`.
- Follow TDD: failing test, observed failure, minimal code, passing focused test, full suite, commit.

---

### Task 1: Import the submitted PS2 baseline

**Files:**
- Copy: `assignments/ps2-web-app/{index.html,package.json,package-lock.json,vite.config.js,.gitignore}` to repository root
- Copy: `assignments/ps2-web-app/{src,server,test}/` to repository root
- Create: `README.md`

**Interfaces:**
- Consumes: `C:/Users/User/OneDrive/Documents/si212/assignments/ps2-web-app`
- Produces: a root Vite/Express project passing its unchanged PS2 tests and build

- [ ] **Step 1: Copy application files only**

```powershell
$source = 'C:\Users\User\OneDrive\Documents\si212\assignments\ps2-web-app'
Copy-Item "$source\index.html", "$source\package.json", "$source\package-lock.json", "$source\vite.config.js", "$source\.gitignore" -Destination .
Copy-Item "$source\src", "$source\server", "$source\test" -Destination . -Recurse
```

Do not copy `INSTRUCTIONS.md`, `REFLECTION.md`, `tasks/`, `rubrics/`, `data/`, `dist/`, `node_modules/`, or `.env`.

- [ ] **Step 2: Add README.md**

```markdown
# Cooking Saver

Cooking Saver is a React and Express recipe application built for SI 212. It searches a persistent recipe collection and begins with ten starter recipes.

Run `npm ci`, `npm test`, and `npm run dev` for local development. Deployment settings are documented by name only in `DEPLOY.md`.
```

- [ ] **Step 3: Verify the baseline**

Run `npm.cmd ci`, `npm.cmd test`, and `npm.cmd run build`.

Expected: all copied tests pass and Vite creates `dist/`.

- [ ] **Step 4: Commit**

```powershell
git add .gitignore README.md index.html package.json package-lock.json vite.config.js src server test
git commit -m "chore: import Cooking Saver PS2 baseline"
```

---

### Task 2: Add PostgreSQL migrations and starter data

**Files:**
- Modify: `package.json`, `package-lock.json`
- Replace: `server/db.js`, `test/db.test.js`
- Create: `server/migrations/001-initial-schema.sql`, `server/starter-recipes.js`, `test/postgres.js`

**Interfaces:**
- Produces: `openDatabase(connectionString): Pool`, `migrateDatabase(pool): Promise<void>`, `seedStarterRecipes(pool): Promise<void>`
- Produces: `createTestPool(): Pool`, using `TEST_DATABASE_URL` when present and `pg-mem` otherwise

- [ ] **Step 1: Change dependencies**

```powershell
npm.cmd uninstall better-sqlite3
npm.cmd install pg
npm.cmd install --save-dev pg-mem
```

- [ ] **Step 2: Write the failing database test**

```js
it("creates exactly ten starter recipes idempotently", async () => {
  pool = createTestPool();
  await migrateDatabase(pool);
  await seedStarterRecipes(pool);
  await migrateDatabase(pool);
  await seedStarterRecipes(pool);
  const result = await pool.query(
    "SELECT name, view_count FROM recipes WHERE source = 'starter' ORDER BY name"
  );
  expect(result.rows).toHaveLength(10);
  expect(result.rows.every((row) => row.view_count === 0)).toBe(true);
  expect(result.rows.map((row) => row.name)).toContain("Chocolate Chip Cookies");
});
```

- [ ] **Step 3: Observe failure**

Run: `npm.cmd test -- --project server test/db.test.js`

Expected: FAIL because PostgreSQL helpers do not exist.

- [ ] **Step 4: Create the schema migration**

```sql
CREATE TABLE IF NOT EXISTS recipes (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  seed_key TEXT UNIQUE,
  name TEXT NOT NULL,
  prep_minutes INTEGER NOT NULL CHECK (prep_minutes >= 0),
  cook_minutes INTEGER NOT NULL CHECK (cook_minutes >= 0),
  servings INTEGER NOT NULL CHECK (servings > 0),
  notes TEXT,
  source TEXT NOT NULL CHECK (source IN ('starter', 'manual', 'ai')),
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ingredients (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0), quantity TEXT NOT NULL, name TEXT NOT NULL,
  UNIQUE (recipe_id, position)
);
CREATE TABLE IF NOT EXISTS instructions (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0), text TEXT NOT NULL,
  UNIQUE (recipe_id, position)
);
```

- [ ] **Step 5: Implement migration and transactional seed**

Read the SQL migration with `readFile`, execute it, then seed through one checked-out client inside `BEGIN`/`COMMIT`; `ROLLBACK` and rethrow on failure. `server/starter-recipes.js` exports ten complete objects with stable keys, full ingredients, and full instructions. Insert parents with `ON CONFLICT (seed_key) DO NOTHING RETURNING id`; insert children only when an id returns.

The ten names are: Spaghetti Aglio e Olio, Chicken Fried Rice, Beef Tacos, Tomato Soup, Chickpea Curry, Baked Salmon, Vegetable Stir-Fry, Chicken Noodle Soup, Pancakes, and Chocolate Chip Cookies.

- [ ] **Step 6: Verify and commit**

Run the focused test. Then run `npm.cmd test`; API tests may fail until Task 3, and their names must be recorded in the handoff.

```powershell
git add package.json package-lock.json server/db.js server/migrations server/starter-recipes.js test/db.test.js test/postgres.js
git commit -m "feat: add PostgreSQL schema and starter recipes"
```

---

### Task 3: Convert persistence and routes to asynchronous PostgreSQL

**Files:**
- Replace: `server/recipe-repository.js`
- Modify: `server/recipe-routes.js`, `server/app.js`
- Modify: `test/{recipes-api,search-and-views,error-handling,generation-api}.test.js`

**Interfaces:**
- Produces: `createRecipeRepository(pool)` with async `list`, `getById`, `getByIdAndRecordView`, `search`, `create`, `update`, `remove`
- Produces: `createRecipeRouter({ repository })`

- [ ] **Step 1: Write a failing asynchronous API test**

Migrate a test pool, inject its repository into `createApp`, retain the existing CRUD assertions, and add:

```js
const persisted = await pool.query(
  "SELECT name, servings FROM recipes WHERE id = $1",
  [created.body.id]
);
expect(persisted.rows[0]).toEqual({ name: "Tomato Soup", servings: 4 });
```

- [ ] **Step 2: Observe failure**

Run: `npm.cmd test -- --project server test/recipes-api.test.js`

Expected: FAIL because the SQLite repository is synchronous.

- [ ] **Step 3: Implement parameterized PostgreSQL operations**

Use `$1` parameters and map snake-case rows to the existing JSON shape. `search()` uses `ILIKE $1 ESCAPE '\\'`. Multi-table writes use:

```js
async function withTransaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
```

Increment view count with `UPDATE ... RETURNING *`; update parent and replace children in one transaction without resetting `view_count`; delete with `DELETE ... RETURNING id`.

- [ ] **Step 4: Await routes and forward errors**

```js
router.get("/", async (_request, response, next) => {
  try { response.json(await repository.list()); }
  catch (error) { next(error); }
});
```

Apply the same pattern to every route while preserving current validation responses.

- [ ] **Step 5: Convert remaining server tests**

Replace `openDatabase(":memory:")` with migrated test pools and asynchronous SQL assertions. Close pools with awaited `pool.end()`.

- [ ] **Step 6: Verify and commit**

Run `npm.cmd test -- --project server`, then `npm.cmd test`; both must pass.

```powershell
git add server/recipe-repository.js server/recipe-routes.js server/app.js test
git commit -m "feat: persist recipes in PostgreSQL"
```

---

### Task 4: Add Basic Auth, CORS, version, and production startup

**Files:**
- Create: `server/basic-auth.js`, `server/config.js`, `test/auth-and-version.test.js`
- Modify: `server/app.js`, `server/index.js`, `test/app.test.js`, `test/error-handling.test.js`, `package.json`, `package-lock.json`

**Interfaces:**
- Produces: `createBasicAuth({ username, password }): ExpressMiddleware`
- Produces: `loadConfig(env): { databaseUrl, username, password, allowedOrigins, commit, port }`
- Produces: `createApp({ repository, generateRecipe, auth, allowedOrigins, commit })`

- [ ] **Step 1: Install CORS and write failing tests**

Run `npm.cmd install cors`, then test:

```js
await request(app).get("/api/recipes")
  .expect("WWW-Authenticate", 'Basic realm="Cooking Saver"').expect(401);
await request(app).get("/api/recipes")
  .auth("student", "correct horse battery staple").expect(200);
await request(app).get("/api/version").expect(200, { commit: "abc123" });
await request(app).get("/api/health").expect(401);
```

Also test allowed and rejected Origin headers.

- [ ] **Step 2: Observe failure**

Run: `npm.cmd test -- --project server test/auth-and-version.test.js`

Expected: FAIL because these controls do not exist.

- [ ] **Step 3: Implement Basic Auth safely**

Decode one Basic credential pair and compare username and password with equal-length constant-time buffers. Never log the header or values. On failure:

```js
response.set("WWW-Authenticate", 'Basic realm="Cooking Saver"');
return response.status(401).json({ error: "authentication_required" });
```

- [ ] **Step 4: Order public and protected middleware**

Order: JSON parser, restricted CORS, public `/api/version`, Basic Auth, protected health/recipe/generation routes, JSON error handler. Return `commit || "local"`. PostgreSQL connection failures return `503 { error: "database_unavailable" }`; logs contain only error name, code, and stack.

Update every existing API test to create the app with the same known test credentials and use Supertest's `.auth(username, password)` on requests expected to reach a protected route. This keeps the CRUD and error-handling suites exercising the production security boundary instead of bypassing it.

- [ ] **Step 5: Validate config and migrate before listening**

`loadConfig()` names missing variables without printing values. Startup performs:

```js
const config = loadConfig(process.env);
const pool = openDatabase(config.databaseUrl);
await migrateDatabase(pool);
await seedStarterRecipes(pool);
const repository = createRecipeRepository(pool);
const app = createApp({
  repository,
  auth: { username: config.username, password: config.password },
  allowedOrigins: config.allowedOrigins,
  commit: config.commit
});
```

Listen on `0.0.0.0`; graceful shutdown awaits server close and `pool.end()`.

Change the production package script to `"start": "node server/index.js"`. The frontend is built independently by Render's static-site service, so starting the API must not run `vite build`.

- [ ] **Step 6: Verify and commit**

Run the focused test, full suite, and build; all must pass.

```powershell
git add package.json package-lock.json server test
git commit -m "feat: protect the production API"
```

---

### Task 5: Add the in-app sign-in gate and deployed API URL

**Files:**
- Modify: `src/api.js`, `src/App.jsx`, `src/styles.css`, `test/app.test.jsx`
- Create: `src/components/SignIn.jsx`, `test/sign-in.test.jsx`

**Interfaces:**
- Produces: `setCredentials({ username, password })`, `clearCredentials()`, `verifyCredentials(username, password)`
- Produces: `<SignIn onSignedIn={fn} />`

- [ ] **Step 1: Write failing sign-in tests**

```jsx
render(<App />);
expect(screen.getByRole("heading", { name: /sign in to cooking saver/i })).toBeInTheDocument();
await user.type(screen.getByLabelText(/username/i), "student");
await user.type(screen.getByLabelText(/password/i), "secret");
await user.click(screen.getByRole("button", { name: /sign in/i }));
expect(fetch).toHaveBeenCalledWith(
  "https://api.example.test/api/recipes",
  expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Basic ${btoa("student:secret")}` }) })
);
```

Add a 401 test showing “The username or password is incorrect” and prove neither browser storage API is used.

- [ ] **Step 2: Observe failure**

Run: `npm.cmd test -- --project components test/sign-in.test.jsx`

Expected: FAIL because sign-in does not exist.

- [ ] **Step 3: Implement URL and in-memory credential handling**

Normalize `import.meta.env.VITE_API_BASE_URL`, build every request from it, and keep credentials only in module memory. Add the Basic header only when set. `verifyCredentials()` temporarily sets credentials, calls `listRecipes()`, and clears them before rethrowing on failure.

- [ ] **Step 4: Implement the gate**

`App` begins signed out and renders only the sign-in form. After verification, show existing navigation/routes plus Sign Out. Sign Out clears memory. Do not put credentials in storage, logs, rendered HTML, or URLs.

- [ ] **Step 5: Preserve existing component behavior**

Update old tests to sign in or render routed pages directly. Keep the existing search, recipe management, generation-unavailable, loading, and error behavior. Style only the sign-in addition; do not redesign PS2.

- [ ] **Step 6: Verify and commit**

Run the focused test, full suite, and build; all must pass.

```powershell
git add src test
git commit -m "feat: add shared-password sign in"
```

---

### Task 6: Add CI, Render Blueprint, and DEPLOY.md

**Files:**
- Create: `.github/workflows/ci.yml`, `render.yaml`, `DEPLOY.md`, `test/deployment-config.test.js`
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces: check `test-and-build`, services `cooking-saver-jce0823` and `cooking-saver-api-jce0823`, fixed PS3 documentation lines

- [ ] **Step 1: Write failing config tests**

Install `yaml` as a dev dependency, parse `render.yaml`, and assert both service names and `autoDeployTrigger === "checksPass"`; assert API secrets use `{ sync: false }`. Assert DEPLOY.md starts with:

```text
App: https://cooking-saver-jce0823.onrender.com
API: https://cooking-saver-api-jce0823.onrender.com
Protected: /api/recipes
```

- [ ] **Step 2: Observe failure**

Run: `npm.cmd test -- --project server test/deployment-config.test.js`

Expected: FAIL because deployment files do not exist.

- [ ] **Step 3: Add GitHub Actions with PostgreSQL 17**

Trigger pull requests and pushes to `main`; use `actions/checkout@v5`, `actions/setup-node@v4` with Node 22/npm cache, and a healthy `postgres:17` service. Set disposable `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cooking_saver_test`; run `npm ci`, `npm test`, and `npm run build`.

- [ ] **Step 4: Create render.yaml**

```yaml
services:
  - type: web
    runtime: static
    name: cooking-saver-jce0823
    buildCommand: npm ci && npm run build
    staticPublishPath: ./dist
    autoDeployTrigger: checksPass
    envVars:
      - key: VITE_API_BASE_URL
        value: https://cooking-saver-api-jce0823.onrender.com
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
  - type: web
    runtime: node
    name: cooking-saver-api-jce0823
    plan: free
    buildCommand: npm ci
    startCommand: npm start
    autoDeployTrigger: checksPass
    healthCheckPath: /api/version
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: BASIC_AUTH_USERNAME
        sync: false
      - key: BASIC_AUTH_PASSWORD
        sync: false
      - key: FRONTEND_ORIGIN
        value: https://cooking-saver-jce0823.onrender.com
```

- [ ] **Step 5: Write DEPLOY.md**

Use the exact first three lines above. Then name each host and component; list every setting by name and location; describe Part A shared-password access and state that Part B roles replace it. Never include a value for a secret.

- [ ] **Step 6: Verify and commit**

Run focused test, full suite, build, and `git diff --check`; all pass.

```powershell
git add .github/workflows/ci.yml render.yaml DEPLOY.md package.json package-lock.json test/deployment-config.test.js
git commit -m "ci: gate Render deployments on tests"
```

---

### Task 7: Provision and verify Part A

**Files:**
- Modify only if Render assigns different URLs: `render.yaml`, `DEPLOY.md`

**Interfaces:**
- Produces: live App/API, persistent recipes, passing checks, and verified auto-deploy

- [ ] **Step 1: Push and wait for CI**

```powershell
git push origin main
gh run watch --exit-status
```

If it fails, inspect the failed job, add a local regression test, fix, commit, push, and watch again.

- [ ] **Step 2: Create Neon production database**

The user creates a dedicated Neon project and keeps the connection string out of chat and files.

- [ ] **Step 3: Create Render Blueprint**

The user connects Render to the private repository and enters `DATABASE_URL`, `BASIC_AUTH_USERNAME`, and `BASIC_AUTH_PASSWORD` directly. Confirm both services say After CI Checks Pass. If a service name changes, update `render.yaml`, `VITE_API_BASE_URL`, `FRONTEND_ORIGIN`, and the first two DEPLOY.md lines; test and commit before continuing.

- [ ] **Step 4: Verify protection and version**

```powershell
curl.exe -i https://cooking-saver-api-jce0823.onrender.com/api/recipes
curl.exe -s https://cooking-saver-api-jce0823.onrender.com/api/version
git rev-parse HEAD
```

Expected: 401 for recipes; version commit equals `HEAD`.

- [ ] **Step 5: Verify persistence and auto-deploy**

Sign in, create one manual recipe, push a small visible text change, wait for checks and deploys, then confirm both the change and saved recipe remain.

- [ ] **Step 6: Verify the test gate**

On a temporary branch, add a deliberately failing test and run its check without merging. Confirm no production deploy starts. Remove the failure before any merge; never push a known failure to `main`.

- [ ] **Step 7: Verify logs**

Make one authenticated live request and locate its Render backend log line. Confirm it includes method/path/status/timing and excludes Authorization, credentials, and database URL.

- [ ] **Step 8: Final checks**

Run `npm.cmd test`, `npm.cmd run build`, `git status --short`, and a full-history secret scan. If any real secret appears, revoke it and stop before making the repository public.

- [ ] **Step 9: Commit URL corrections if needed**

```powershell
git add render.yaml DEPLOY.md
git commit -m "docs: record live deployment URLs"
git push origin main
```

Do not create an empty commit when URLs did not change.

---

## Part A completion gate

Part A is complete only after the user personally confirms the live frontend, persistence after redeploy, unauthenticated 401, matching version commit, and Render log evidence. Stop there. Start a new Superpowers brainstorming pass for Part B Google OAuth, user migrations, and server-enforced owner/user authorization.
