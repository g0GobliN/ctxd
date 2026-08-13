import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Admin dev server. Its HMR port must not collide with the web app. */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    hmr: { port: 5174 },
  },
  build: { outDir: "dist", sourcemap: true },
});
