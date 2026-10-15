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
  });

  it("keeps API secrets as host-provided settings", () => {
    const api = renderConfig.services.find((service) => service.name === "cooking-saver-api-jce0823");
    const vars = Object.fromEntries(api.envVars.map((variable) => [variable.key, variable]));
    expect(vars.DATABASE_URL).toEqual({ key: "DATABASE_URL", sync: false });
    expect(vars.BASIC_AUTH_USERNAME).toEqual({ key: "BASIC_AUTH_USERNAME", sync: false });
    expect(vars.BASIC_AUTH_PASSWORD).toEqual({ key: "BASIC_AUTH_PASSWORD", sync: false });
  });

  it("starts DEPLOY.md with the fixed PS3 endpoints", () => {
    expect(deployGuide.startsWith([
      "App: https://cooking-saver-jce0823.onrender.com",
      "API: https://cooking-saver-api-jce0823.onrender.com",
      "Protected: /api/recipes"
    ].join("\n"))).toBe(true);
  });
});
