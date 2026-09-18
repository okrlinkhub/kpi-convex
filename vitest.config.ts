import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    typecheck: { tsconfig: "./tsconfig.test.json" },
    environmentMatchGlobs: [["src/react/**/*.test.tsx", "jsdom"]],
  },
});
