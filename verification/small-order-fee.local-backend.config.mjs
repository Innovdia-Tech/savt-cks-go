import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";

const backend = process.env.SMALL_ORDER_BACKEND_ROOT;
if (!backend)
  throw new Error("Set SMALL_ORDER_BACKEND_ROOT to the pinned local handoff.");
const require = createRequire(resolve(backend, "package.json"));
export default {
  resolve: {
    alias: {
      vitest: resolve(
        dirname(require.resolve("vitest/package.json")),
        "dist/index.js",
      ),
      "@small-order-backend-fixture": resolve(
        backend,
        "apps/api/src/modules/checkout/checkout-quote.fixture.ts",
      ),
      "@small-order-backend-controller": resolve(
        backend,
        "apps/api/src/modules/checkout/checkout-quote.controller.ts",
      ),
    },
  },
  test: {
    include: ["verification/small-order-fee.local-backend.check.ts"],
    maxWorkers: 1,
  },
};
