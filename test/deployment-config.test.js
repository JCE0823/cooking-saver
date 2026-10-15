import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const renderConfig = parse(await readFile(new URL("../render.yaml", import.meta.url), "utf8"));
const deployGuide = await readFile(new URL("../DEPLOY.md", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const normalizedDeployGuide = deployGuide.replaceAll("\r\n", "\n");
const normalizedReadme = readme.replaceAll("\r\n", "\n");

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
    expect(api.buildCommand).toBe("npm ci && npm run build");
    expect(api.startCommand).toBe("npm start");
    expect(api.healthCheckPath).toBe("/api/version");
  });

  it("keeps API secrets as host-provided settings", () => {
    const api = renderConfig.services.find((service) => service.name === "cooking-saver-api-jce0823");
    expect(api.envVars).toEqual(expect.arrayContaining([
      { key: "DATABASE_URL", sync: false },
      { key: "GOOGLE_CLIENT_ID", sync: false },
      { key: "OWNER_EMAIL", sync: false }
    ]));
    expect(api.envVars.some((variable) => variable.key.includes("OPENAI") || variable.key.includes("UMGPT"))).toBe(false);
  });

  it("starts DEPLOY.md with the fixed PS3 endpoints", () => {
    expect(normalizedDeployGuide.startsWith([
      "App: https://cooking-saver-api-jce0823.onrender.com",
      "Protected: /api/recipes"
    ].join("\n"))).toBe(true);
    expect(deployGuide).toContain("Neon");
    expect(deployGuide).toContain("proxy forwards requests to `http://localhost:3000`");
  });

  it("documents development cookies for local HTTP", () => {
    expect(normalizedDeployGuide).toContain("NODE_ENV=development");
    expect(normalizedReadme).toContain("NODE_ENV=development");
    expect(normalizedDeployGuide).toContain("http://localhost:5173");
    expect(normalizedDeployGuide).toContain("authorized JavaScript origins");
    expect(normalizedDeployGuide).toContain("browser frontend origin");
    expect(normalizedDeployGuide).toContain("no verified Google-session");
    expect(normalizedDeployGuide).toContain("Basic Auth commit");
    expect(normalizedDeployGuide).toContain("previously verified Part B Google-auth/full-stack");
    expect(normalizedDeployGuide).toContain("never an authentication rollback target");
    expect(normalizedDeployGuide).not.toContain("Part A deployment/commit");
    expect(normalizedDeployGuide).not.toContain("static service available while investigating");
  });
});
