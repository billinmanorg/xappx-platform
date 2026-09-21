import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Normal build (`vite build`) → hashed assets in dist/, for the same-domain deploy.
// Preview build (`vite build --mode preview`) → one self-contained HTML file in
// dist-preview/ (JS, CSS and images inlined) for publishing as a shareable
// staging Artifact — no server needed.
export default defineConfig(({ mode }) => {
  const single = mode === "preview";
  return {
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    build: {
      outDir: single ? "dist-preview" : "dist",
      sourcemap: false,
      ...(single ? { assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 4000 } : {}),
    },
  };
});
