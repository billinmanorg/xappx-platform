import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const productionCsp = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
].join("; ");

export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL("./preview", import.meta.url)),
  publicDir: false,
  plugins: [
    react(),
    // Development needs Vite's HMR connection. Only the static build is locked down.
    ...(command === "build" ? [{
      name: "click-preview-production-csp",
      transformIndexHtml() {
        return [{
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: productionCsp },
          injectTo: "head-prepend" as const,
        }];
      },
    }] : []),
  ],
  build: {
    outDir: "../dist-click-preview",
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 0,
  },
}));
