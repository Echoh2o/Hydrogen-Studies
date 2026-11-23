// Next.js front door for the public site (PLAN Phase 3, docs/PHASE3_MIGRATION.md).
// Migrated routes render here; everything else — and always /api, /admin,
// /uploads, /proxy, auth — falls through to Express via the fallback rewrite.
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPRESS_ORIGIN = process.env.EXPRESS_ORIGIN || "http://localhost:5000";

/** @type {import('next').NextConfig} */
export default {
  output: "standalone",
  poweredByHeader: false,
  // No page uses next/image. Unoptimized makes Next answer /_next/image with a
  // 404, closing the image-optimizer RCE/DoS advisories (< 15.5.24) on both the
  // apex and the web service's own railway.app domain until Next is upgraded.
  images: { unoptimized: true },
  reactStrictMode: true,
  outputFileTracingRoot: repoRoot,
  experimental: {
    // Compile ../shared (the helpers the crawler renderer and SPA already use).
    externalDir: true,
  },
  // The SPA's analytics/consent modules (client/src/lib) read Vite env vars;
  // define them at build time so they run unchanged here.
  webpack(config, { webpack }) {
    config.plugins.push(
      new webpack.DefinePlugin({
        "import.meta.env.VITE_GA_MEASUREMENT_ID": JSON.stringify(process.env.VITE_GA_MEASUREMENT_ID ?? ""),
        "import.meta.env.DEV": "false",
        "import.meta.env.PROD": "true",
        "import.meta.env.MODE": JSON.stringify("production"),
      }),
    );
    return config;
  },
  async rewrites() {
    return {
      // Runs only when no Next route or public file matched.
      // Never /_next/*: a missing chunk is Next's own 404, not a trip back to
      // Express (which used to proxy it to Next again — a loop).
      fallback: [{ source: "/:path((?!_next/).*)", destination: `${EXPRESS_ORIGIN}/:path` }],
    };
  },
};
