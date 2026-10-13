import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/click-preview/setup.ts"],
    include: ["test/click-preview/**/*.test.{ts,tsx}"],
  },
});
