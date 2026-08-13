import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Web app dev server.
 *
 * The HMR port is pinned deliberately. Two applications in this repository ran
 * their dev servers on the default port, and whichever started second silently
 * took a different one — so HMR connected to the wrong app. See BUG #91.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
  build: { outDir: "dist", sourcemap: true },
});
