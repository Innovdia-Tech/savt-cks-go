import { afterEach, expect, it, vi } from "vitest";
import { resolveConfig } from "vite";

afterEach(() => vi.unstubAllEnvs());

it("rejects cross-origin customer API configuration during a deployable build", async () => {
  vi.stubEnv("VITE_CUSTOMER_API_ORIGIN", "https://api.example.test");
  await expect(
    resolveConfig(
      { configFile: "vite.config.js", logLevel: "silent" },
      "build",
    ),
  ).rejects.toThrow("VITE_CUSTOMER_API_ORIGIN must be empty");
});

it("builds with relative customer API configuration and server-only upstream", async () => {
  vi.stubEnv("VITE_CUSTOMER_API_ORIGIN", "");
  vi.stubEnv("CKS_GO_API_PROXY_TARGET", "http://api.internal:3000");
  const config = await resolveConfig(
    { configFile: "vite.config.js", logLevel: "silent" },
    "build",
  );
  expect(config.env.VITE_CUSTOMER_API_ORIGIN).toBe("");
  expect(config.env).not.toHaveProperty("CKS_GO_API_PROXY_TARGET");
});
