import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "receipt-device-dist",
    rollupOptions: { input: "verification/receipt-native.html" },
  },
});
