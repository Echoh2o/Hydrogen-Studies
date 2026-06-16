import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    // Upload client source maps to Sentry during the build so production stack
    // traces are de-minified. Only runs when SENTRY_AUTH_TOKEN is present (set
    // in the Railway build env), so local/CI builds without the token are
    // unaffected. Source maps are emitted "hidden" (see build.sourcemap below)
    // and the plugin deletes them after upload, so they are never deployed.
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: "echo-water",
            project: "hydrogen-studies-client",
            authToken: process.env.SENTRY_AUTH_TOKEN,
            sourcemaps: {
              // Delete the emitted .map files after upload so they are never
              // served from the production bundle.
              filesToDeleteAfterUpload: ["./dist/public/**/*.map"],
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
            if (id.includes("react-dom")) return "vendor";
            if (id.includes("react/")) return "vendor";
            if (id.includes("wouter")) return "router";
            if (id.includes("@tanstack/react-query")) return "query";
            if (id.includes("@radix-ui/")) return "ui";
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("recharts")) return "charts";
            if (id.includes("framer-motion")) return "animation";
            if (id.includes("dompurify") || id.includes("react-helmet")) return "seo";
          }
        },
      },
    },
  },
});
