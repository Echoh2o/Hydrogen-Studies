#!/usr/bin/env node
/**
 * Remove client .map files from the production build so they are never served
 * publicly. Source maps are uploaded to Sentry during `vite build` (see the
 * sentryVitePlugin config in vite.config.ts); this step guarantees their
 * removal from the deploy artifact regardless of the plugin's own
 * filesToDeleteAfterUpload behavior (which did not run in Railway's Railpack
 * build). The server serves static assets from dist/public (server/index.ts),
 * so any .map left there is publicly fetchable.
 *
 * Gated on SENTRY_AUTH_TOKEN: only strips when maps were actually uploaded
 * (production builds), leaving local debug builds untouched.
 */
import { readdirSync, statSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.SENTRY_AUTH_TOKEN) {
  console.log(
    "[strip-sourcemaps] SENTRY_AUTH_TOKEN unset — keeping source maps (local build)",
  );
  process.exit(0);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const target = join(scriptDir, "..", "dist", "public");

let removed = 0;
function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return; // dir missing — nothing to strip
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".map")) {
      rmSync(p);
      removed++;
    }
  }
}

walk(target);
console.log(`[strip-sourcemaps] removed ${removed} .map file(s) from dist/public`);
