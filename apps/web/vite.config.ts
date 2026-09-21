import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// XAPPX marketing + builder front-end. Builds to static assets served by Render
// (alongside the current static site until it reaches parity, then replaces it).
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false },
});
