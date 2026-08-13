import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The interface is built to static files that the local API serves itself.
 *
 * `base: "./"` keeps every asset reference relative, so the bundle works no
 * matter which port `ctxd ui` ended up on. Nothing is fetched from a CDN: the
 * UI has to work with no network at all (§66).
 */
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // One JS file and one CSS file: this is a local tool, not a site that
    // benefits from code splitting over a network.
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 4318,
    // In dev the Vite server proxies to the real API so the browser sees one
    // origin and the loopback Origin check stays satisfied.
    proxy: {
      "/api": "http://127.0.0.1:4317",
    },
  },
});
