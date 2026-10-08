import { defineConfig, mergeConfig } from "vite";
import path from "node:path";
import { execFileSync } from "node:child_process";
import baseConfig from "../../vite.config.js";

const baselineRevision = "094a78e96851462b7c02cf147081a4642b16b2eb";
const baselineFiles = new Set([
  ...(process.env.CKS_GO_STARTUP_BASELINE === "1"
    ? ["src/catalogue/components.tsx"]
    : []),
  ...(process.env.CKS_GO_ADDRESS_BASELINE === "1"
    ? [
        "src/customer/DeliveryAddressPicker.tsx",
        "src/customer/DeliveryLocationSetup.tsx",
      ]
    : []),
]);
const fixtureCache = process.env.CKS_GO_BROWSER_FIXTURE_CACHE;

export default defineConfig((environment) =>
  mergeConfig(baseConfig(environment), {
    cacheDir: path.resolve(
      `verification/cust-ux-batch01/.cache/${fixtureCache ?? environment.mode}/node_modules/.vite`,
    ),
    plugins: [
      {
        name: "cust-ux-batch01-original-source",
        load(id) {
          const relative = path
            .relative(process.cwd(), id.split("?")[0])
            .replace(/\\/g, "/");
          if (!baselineFiles.has(relative)) return null;
          return execFileSync(
            "git",
            ["show", `${baselineRevision}:${relative}`],
            {
              cwd: process.cwd(),
              encoding: "utf8",
              windowsHide: true,
            },
          );
        },
      },
    ],
    define: {
      "import.meta.env.VITE_CUSTOMER_API_ORIGIN": '""',
      "import.meta.env.VITE_CKS_GO_DEVELOPMENT_API": '"false"',
      "import.meta.env.VITE_CKS_GO_DEVELOPMENT_BRIDGE": '"false"',
      "import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY": '"browser-fixture-key"',
    },
  }),
);
