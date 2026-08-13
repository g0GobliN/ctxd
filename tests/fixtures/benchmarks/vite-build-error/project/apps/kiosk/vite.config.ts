import { defineConfig } from "vite";

/** Kiosk dev server. */
export default defineConfig({
  server: { port: 5175, strictPort: true, hmr: { port: 5175 } },
  build: { outDir: "dist" },
});
