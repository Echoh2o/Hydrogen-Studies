import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
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
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  test: {
    globals: true,
    projects: [
      {
        test: {
          name: "server",
          environment: "node",
          include: ["server/__tests__/**/*.test.ts"],
          globals: true,
        },
        resolve: {
          alias: {
            "@shared": path.resolve(import.meta.dirname, "shared"),
          },
        },
      },
      {
        test: {
          name: "client",
          environment: "node",
          include: ["client/src/__tests__/**/*.test.ts"],
          globals: true,
        },
        resolve: {
          alias: {
            "@": path.resolve(import.meta.dirname, "client", "src"),
            "@shared": path.resolve(import.meta.dirname, "shared"),
            "@assets": path.resolve(import.meta.dirname, "attached_assets"),
          },
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["server/**/*.ts", "client/src/lib/**/*.ts"],
      exclude: [
        "server/seed.ts",
        "server/__tests__/**",
        "client/src/__tests__/**",
      ],
    },
  },
});
