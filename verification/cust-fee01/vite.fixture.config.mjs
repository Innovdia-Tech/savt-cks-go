import { defineConfig, mergeConfig } from "vite";
import path from "node:path";
import baseConfig from "../../vite.config.js";

export default defineConfig((environment) =>
  mergeConfig(baseConfig(environment), {
    cacheDir: path.resolve("verification/cust-fee01/.cache/node_modules/.vite"),
  }),
);
