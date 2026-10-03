import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, process.cwd(), "VITE_");
  if (command === "build" && environment.VITE_CUSTOMER_API_ORIGIN?.trim()) {
    throw new Error(
      "VITE_CUSTOMER_API_ORIGIN must be empty for same-origin customer builds. Configure CKS_GO_API_PROXY_TARGET on the server instead.",
    );
  }
  if (
    command === "build" &&
    environment.VITE_CKS_GO_LOCAL_PAYMENT_SIMULATOR_ORIGIN
  ) {
    throw new Error(
      "VITE_CKS_GO_LOCAL_PAYMENT_SIMULATOR_ORIGIN must be empty for customer builds.",
    );
  }
  return {
    plugins: [react()],
    optimizeDeps: {
      noDiscovery: true,
      include: ["react", "react-dom/client", "react/jsx-dev-runtime"],
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
    },
  };
});
