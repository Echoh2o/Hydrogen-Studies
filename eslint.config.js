// @ts-check
// Flat ESLint config (ESLint v9+). Deliberately minimal: it enforces only the
// two rules the audit called for so it can be introduced without flooding CI
// with unrelated findings. Requires the following devDependencies (installed by
// the maintainer, not committed here):
//   eslint, typescript-eslint
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Never lint build output, deps, or generated artifacts.
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "**/*.d.ts",
    ],
  },
  {
    // Scope: server code and the React client source only.
    files: ["server/**/*.ts", "client/src/**/*.{ts,tsx}"],
    // Tests are excluded so no-floating-promises stays focused on product code
    // and so type-aware linting does not choke on test-only tsconfig gaps.
    ignores: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // Type-aware linting (required by no-floating-promises). projectService
        // resolves the nearest tsconfig per file automatically.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // Unhandled promises are a real correctness hazard in the sync/queue code.
      "@typescript-eslint/no-floating-promises": "error",
      // Ratchet: warn only for now (non-blocking) so the existing console usage
      // does not fail CI; tighten to "error" once the count is driven down.
      "no-console": "warn",
    },
  },
);
