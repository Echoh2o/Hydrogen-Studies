import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Regression guard for two boot-time invariants that are easy to break with an
 * innocent-looking edit to server/app.ts and impossible to catch without a
 * running database:
 *
 *   (a) The runMigrations([...]) manifest must have unique, contiguously
 *       monotonically-numbered migration names, and every referenced `up`
 *       function must resolve to a real migration module that exports it.
 *       A duplicate name silently skips a migration (the runner keys on name);
 *       a gap/reorder makes the applied-migration ledger ambiguous.
 *
 *   (b) The admin OAuth callback routers (/api/admin/gsc, /api/admin/ga4) must
 *       be mounted BEFORE the wide `/api/admin` catch-all that does
 *       `router.use(requireAdmin)` (adminMonitoringRoutes). If a future edit
 *       reorders them, Express hits the requireAdmin catch-all first and the
 *       unauthenticated Google OAuth redirect gets rejected before it can be
 *       handled — breaking the GSC/GA4 connect flow in a way no unit test that
 *       imports the app would notice.
 *
 * This test parses source text rather than importing server/app.ts, because
 * importing app.ts boots the whole app (DB pool, migration/exit chain). Static
 * inspection keeps it deterministic, fast, and DB-free.
 */

const here = dirname(fileURLToPath(import.meta.url));
const APP_TS = resolve(here, "..", "app.ts");
const MIGRATIONS_DIR = resolve(here, "..", "migrations");

const appSource = readFileSync(APP_TS, "utf8");

/** Extract the argument array literal passed to `runMigrations([...])`. */
function extractManifestBlock(src: string): string {
  const start = src.indexOf("runMigrations([");
  expect(start, "runMigrations([...]) call not found in app.ts").toBeGreaterThanOrEqual(0);
  const open = src.indexOf("[", start);
  // Walk brackets to find the matching close, so nested {} don't confuse us.
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error("Unterminated runMigrations([...]) array in app.ts");
}

interface ManifestEntry {
  name: string;
  up: string; // the identifier used as the `up` value
}

function parseManifest(block: string): ManifestEntry[] {
  const entries: ManifestEntry[] = [];
  const re = /\{\s*name:\s*["']([^"']+)["']\s*,\s*up:\s*([A-Za-z0-9_$]+)\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    entries.push({ name: m[1], up: m[2] });
  }
  return entries;
}

/**
 * Map every `const { Ident } = await import("./migrations/<path>")` in app.ts
 * to its module path, so we can resolve each manifest `up` identifier back to
 * the file that must export it.
 */
function parseMigrationImports(src: string): Map<string, string> {
  const map = new Map<string, string>();
  const re =
    /const\s*\{\s*([A-Za-z0-9_$]+)\s*\}\s*=\s*await\s+import\(\s*["']\.\/migrations\/([^"']+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    map.set(m[1], m[2]);
  }
  return map;
}

/** Does `moduleSource` export a binding named `ident`? */
function exportsIdentifier(moduleSource: string, ident: string): boolean {
  const escaped = ident.replace(/[$]/g, "\\$");
  const patterns = [
    new RegExp(`export\\s+(?:async\\s+)?function\\s+${escaped}\\b`),
    new RegExp(`export\\s+(?:const|let|var)\\s+${escaped}\\b`),
    // export { addX } or export { internalName as addX }
    new RegExp(`export\\s*\\{[^}]*\\b(?:as\\s+)?${escaped}\\b[^}]*\\}`),
  ];
  return patterns.some((p) => p.test(moduleSource));
}

const manifestBlock = extractManifestBlock(appSource);
const manifest = parseManifest(manifestBlock);
const importMap = parseMigrationImports(appSource);

describe("runMigrations manifest integrity (server/app.ts)", () => {
  it("parses a non-empty manifest (guards against a broken refactor)", () => {
    // If this fails, the regex or the manifest shape changed — the rest of the
    // suite would vacuously pass, so fail loudly here instead.
    expect(manifest.length).toBeGreaterThan(0);
  });

  it("has unique migration names", () => {
    const names = manifest.map((e) => e.name);
    const seen = new Set<string>();
    const dupes = names.filter((n) => (seen.has(n) ? true : (seen.add(n), false)));
    expect(dupes, `duplicate migration name(s): ${dupes.join(", ")}`).toEqual([]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has unique migration up-functions (no module reused for two entries)", () => {
    const ups = manifest.map((e) => e.up);
    expect(new Set(ups).size, `duplicate up fn: ${ups.join(", ")}`).toBe(ups.length);
  });

  it("has contiguous, monotonically-increasing numeric prefixes (NNN_...)", () => {
    const numbers = manifest.map((e) => {
      const m = /^(\d+)_/.exec(e.name);
      expect(m, `migration name "${e.name}" must start with a numeric prefix like 001_`).not.toBeNull();
      return Number(m![1]);
    });
    // Each entry must be exactly one greater than the previous, in listed order.
    for (let i = 0; i < numbers.length; i++) {
      expect(
        numbers[i],
        `migration #${i} ("${manifest[i].name}") breaks the sequence: expected ${i + 1}, got ${numbers[i]}`,
      ).toBe(i + 1);
    }
  });

  it("references only migration modules imported in app.ts, and each exports its up fn", () => {
    for (const entry of manifest) {
      const modulePath = importMap.get(entry.up);
      expect(
        modulePath,
        `manifest entry "${entry.name}" uses up:${entry.up}, which is not imported from ./migrations/* in app.ts`,
      ).toBeDefined();

      const file = resolve(MIGRATIONS_DIR, `${modulePath}.ts`);
      expect(existsSync(file), `migration module not found on disk: ${file}`).toBe(true);

      const moduleSource = readFileSync(file, "utf8");
      expect(
        exportsIdentifier(moduleSource, entry.up),
        `migration module ${modulePath}.ts does not export "${entry.up}" (referenced by "${entry.name}")`,
      ).toBe(true);
    }
  });
});

describe("admin OAuth callback mount order (server/app.ts)", () => {
  // The wide catch-all is the second mount of adminMonitoringRoutes at the bare
  // "/api/admin" prefix — it carries router.use(requireAdmin) at its top.
  const wideCatchAll = /app\.use\(\s*["']\/api\/admin["']\s*,\s*adminMonitoringRoutes\s*\)/;
  const gscMount = /app\.use\(\s*["']\/api\/admin\/gsc["']/;
  const ga4Mount = /app\.use\(\s*["']\/api\/admin\/ga4["']/;

  function indexOf(re: RegExp, label: string): number {
    const m = re.exec(appSource);
    expect(m, `expected mount not found in app.ts: ${label}`).not.toBeNull();
    return m!.index;
  }

  it("mounts the requireAdmin /api/admin catch-all (adminMonitoringRoutes)", () => {
    expect(wideCatchAll.test(appSource)).toBe(true);
  });

  it("mounts /api/admin/gsc BEFORE the wide /api/admin catch-all", () => {
    const gsc = indexOf(gscMount, "/api/admin/gsc");
    const wide = indexOf(wideCatchAll, "/api/admin (adminMonitoringRoutes)");
    expect(
      gsc,
      "admin-gsc-routes (OAuth callback) must be mounted before the requireAdmin /api/admin catch-all",
    ).toBeLessThan(wide);
  });

  it("mounts /api/admin/ga4 BEFORE the wide /api/admin catch-all", () => {
    const ga4 = indexOf(ga4Mount, "/api/admin/ga4");
    const wide = indexOf(wideCatchAll, "/api/admin (adminMonitoringRoutes)");
    expect(
      ga4,
      "admin-ga4-routes (OAuth callback) must be mounted before the requireAdmin /api/admin catch-all",
    ).toBeLessThan(wide);
  });
});
