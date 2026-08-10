import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";

// Release name shared with the server (see server/utils/sentry.ts and
// error-reporting.ts). RAILWAY_GIT_COMMIT_SHA is injected by Railway per deploy;
// SENTRY_RELEASE allows a manual override. Undefined locally/in CI (no release
// association, but sourcemaps still upload via debug IDs).
const sentryRelease =
  process.env.SENTRY_RELEASE || process.env.RAILWAY_GIT_COMMIT_SHA;

export default defineConfig({
  plugins: [
    react(),
    // Upload client source maps to Sentry during the build so production stack
    // traces are de-minified, and tag the build with a release so issues are
    // attributed to a deploy (enables regression detection and, once the Sentry
    // GitHub integration is installed, "Fixes <ISSUE-ID>" commit auto-resolve).
    // Only runs when SENTRY_AUTH_TOKEN is present (set in the Railway build env),
    // so local/CI builds without the token are unaffected.
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: "echo-water",
            project: "hydrogen-studies-client",
            authToken: process.env.SENTRY_AUTH_TOKEN,
            // Sentry build steps (release/sourcemaps) must never fail the deploy.
            // setCommits in particular errors until the Sentry GitHub integration
            // is installed on Echoh2o/Hydrogen-Studies — log and continue.
            errorHandler: (err) =>
              console.warn(`[sentry-vite-plugin] ${err.message}`),
            release: sentryRelease
              ? {
                  name: sentryRelease,
                  // Associate the deploy commit with this release (suspect
                  // commits + "Fixes <ISSUE-ID>" auto-resolve). Activates once
                  // the Sentry GitHub integration is installed.
                  setCommits: {
                    repo: "Echoh2o/Hydrogen-Studies",
                    commit: sentryRelease,
                    ignoreMissing: true,
                    ignoreEmpty: true,
                  },
                  deploy: { env: "production" },
                }
              : undefined,
            sourcemaps: {
              // Delete the emitted .map files after upload so they are never
              // served from the production bundle. Absolute path so the glob
              // resolves regardless of the build's working directory.
              filesToDeleteAfterUpload: [
                path.resolve(import.meta.dirname, "dist", "public", "**", "*.map"),
              ],
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist", "public"),
    emptyOutDir: true,
    sourcemap: "hidden",
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // Anchor the react core matches to node_modules/react(-dom)/ so a
            // bare "react/" substring does not also swallow lucide-react,
            // @sentry/react, etc. into the eager vendor chunk (those have their
            // own chunk rules / colocation below).
            if (id.includes("node_modules/react-dom/")) return "vendor";
            if (id.includes("node_modules/react/")) return "vendor";
            // cn() (client/src/lib/utils.ts) pulls clsx + tailwind-merge, and
            // cva is used by eagerly-rendered UI, so these tiny shared utils are
            // reachable from the entry. Pin them into the eager vendor chunk so
            // Rollup does not colocate them into the async "charts" chunk and
            // thereby force the entry (and every page) to statically import
            // recharts on first paint.
            if (
              id.includes("node_modules/clsx/") ||
              id.includes("node_modules/tailwind-merge/") ||
              id.includes("node_modules/class-variance-authority/")
            )
              return "vendor";
            if (id.includes("wouter")) return "router";
            if (id.includes("@tanstack/react-query")) return "query";
            if (id.includes("@radix-ui/")) return "ui";
            if (id.includes("lucide-react")) return "icons";
            // recharts (+ d3 + its lodash copy) stays in its own async chunk,
            // only imported by the lazy-loaded chart routes — never the entry.
            if (id.includes("recharts")) return "charts";
            if (id.includes("framer-motion")) return "animation";
            if (id.includes("dompurify") || id.includes("react-helmet")) return "seo";
          }
        },
      },
    },
  },
});
