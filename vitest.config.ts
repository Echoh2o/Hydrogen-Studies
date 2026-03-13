import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", "e2e"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["server/**/*.ts", "client/src/lib/**/*.ts"],
      exclude: ["node_modules", "dist", "e2e"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
