import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { access } from "node:fs/promises";
import { createCustomerServer } from "./server.mjs";

try {
  const { values } = parseArgs({
    options: {
      host: { type: "string", default: "127.0.0.1" },
      port: { type: "string", default: process.env.PORT || "4173" },
    },
  });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
  const distDirectory = fileURLToPath(new URL("../dist/", import.meta.url));
  await access(fileURLToPath(new URL("../dist/index.html", import.meta.url)));
  const server = createCustomerServer({
    target: process.env.CKS_GO_API_PROXY_TARGET,
    distDirectory,
  });
  server.once("error", () => {
    console.error("Customer runtime could not start.");
    process.exitCode = 1;
  });
  server.listen(port, values.host, () =>
    console.log("Customer runtime listening."),
  );
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      server.close();
      const deadline = setTimeout(() => server.closeAllConnections(), 15_000);
      deadline.unref();
    });
  }
} catch {
  // Never print configuration, request data or raw network exceptions.
  console.error(
    "Customer runtime requires a build, valid host/port and CKS_GO_API_PROXY_TARGET HTTP(S) origin.",
  );
  process.exitCode = 1;
}
