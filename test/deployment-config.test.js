import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const renderConfig = parse(await readFile(new URL("../render.yaml", import.meta.url), "utf8"));
const deployGuide = await readFile(new URL("../DEPLOY.md", import.meta.url), "utf8");

describe("deployment configuration", () => {
  it("defines the app and API services with checks-pass deploys", () => {
    expect(renderConfig.services.map((service) => service.name)).toEqual([
      "cooking-saver-jce0823",
      "cooking-saver-api-jce0823"
    ]);
    expect(renderConfig.services.every((service) => service.autoDeployTrigger === "checksPass")).toBe(true);

    const [frontend, api] = renderConfig.services;
    expect(frontend.runtime).toBe("static");
    expect(frontend.buildCommand).toBe("npm ci && npm run build");
    expect(frontend.staticPublishPath).toBe("./dist");
    expect(frontend.routes).toEqual([
      { type: "rewrite", source: "/*", destination: "/index.html" }
    ]);
    expect(api.runtime).toBe("node");
    expect(api.buildCommand).toBe("npm ci");
    expect(api.startCommand).toBe("npm start");
    expect(api.healthCheckPath).toBe("/api/version");
  });

  it("keeps API secrets as host-provided settings", () => {
    const api = renderConfig.services.find((service) => service.name === "cooking-saver-api-jce0823");
    const vars = Object.fromEntries(api.envVars.map((variable) => [variable.key, variable]));
    expect(vars.DATABASE_URL).toEqual({ key: "DATABASE_URL", sync: false });
    expect(vars.BASIC_AUTH_USERNAME).toEqual({ key: "BASIC_AUTH_USERNAME", sync: false });
    expect(vars.BASIC_AUTH_PASSWORD).toEqual({ key: "BASIC_AUTH_PASSWORD", sync: false });
    expect(vars.FRONTEND_ORIGIN).toEqual({
      key: "FRONTEND_ORIGIN",
      value: "https://cooking-saver-jce0823.onrender.com"
    });
    expect(api.envVars.some((variable) => variable.key.includes("AI") || variable.key.includes("OPENAI"))).toBe(false);
  });

  it("starts DEPLOY.md with the fixed PS3 endpoints", () => {
    expect(deployGuide.startsWith([
      "App: https://cooking-saver-jce0823.onrender.com",
      "API: https://cooking-saver-api-jce0823.onrender.com",
      "Protected: /api/recipes"
    ].join("\n"))).toBe(true);
    expect(deployGuide).toContain("Neon");
    expect(deployGuide).toContain("VITE_API_BASE_URL=http://localhost:3000");
  });
});
