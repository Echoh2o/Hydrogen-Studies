import { defineConfig } from "vitest/config";
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
          // Match __tests__ dirs anywhere under client/src (e.g. both
          // client/src/__tests__/ and client/src/lib/__tests__/).
          include: ["client/src/**/__tests__/**/*.test.ts"],
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
      {
        test: {
          name: "client-dom",
          // Component/page/hook tests need a DOM. Run every *.test.tsx
          // under client/src in jsdom so React Testing Library works.
          environment: "jsdom",
          include: ["client/src/**/*.test.tsx"],
          // Extends `expect` with @testing-library/jest-dom matchers
          // (toBeInTheDocument, etc.). Resolved from node_modules.
          setupFiles: ["@testing-library/jest-dom/vitest"],
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
      // Ratchet floor, not an aspirational target: current coverage is
      // ~9%, so these modest thresholds fail the run only on a real
      // regression toward zero. Raise them as coverage improves.
      thresholds: {
        lines: 8,
        statements: 8,
        functions: 8,
        branches: 8,
      },
    },
  },
});
