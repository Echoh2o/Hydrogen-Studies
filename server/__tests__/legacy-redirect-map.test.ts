/**
 * Guards for reports/redirects-legacy-2026-09.csv (the approved legacy-URL
 * 301 map) and the parser/validators in scripts/consolidation/legacy-redirects.ts.
 * The script re-checks everything against the DB + live site at run time;
 * these tests keep the committed CSV itself well-formed.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseCsv, fromPathProblem } from "../../scripts/consolidation/legacy-redirects";

const csvText = fs.readFileSync(path.resolve(__dirname, "../../reports/redirects-legacy-2026-09.csv"), "utf8");
const { header, rows, approved } = parseCsv(csvText);
const applied = rows.filter((r) => r.applied === "yes");
const inserts = applied.filter((r) => !r.previous_to_path);
const repoints = applied.filter((r) => r.previous_to_path);
const key = (p: string) => p.toLowerCase().split("?")[0].replace(/\/+$/, "") || "/";

describe("parseCsv", () => {
  it("handles quoted commas, escaped quotes and the approval marker", () => {
    const parsed = parseCsv('# approved-by: josh (x)\na,b\n"1,2","say ""hi"""\n');
    expect(parsed.approved).toBe(true);
    expect(parsed.rows).toEqual([{ a: "1,2", b: 'say "hi"' }]);
    expect(parseCsv("a\n1\n").approved).toBe(false);
  });
});

describe("fromPathProblem", () => {
  it("accepts legacy paths and rejects live routes / non-canonical forms", () => {
    expect(fromPathProblem("/study/old-title")).toBeNull();
    expect(fromPathProblem("/secondary-topic/chronic-kidney-disease")).toBeNull();
    expect(fromPathProblem("/search")).toMatch(/live route/);
    expect(fromPathProblem("/disclaimer")).toMatch(/live route/);
    expect(fromPathProblem("/category/cancer")).toMatch(/live route prefix/);
    expect(fromPathProblem("/admin/x")).toMatch(/live route prefix/);
    expect(fromPathProblem("/Study/X")).toMatch(/lowercase/);
    expect(fromPathProblem("/study/x/")).toMatch(/trailing slash/);
    expect(fromPathProblem("/study?id=1")).toMatch(/query/);
    expect(fromPathProblem("//evil.com")).toMatch(/site-relative/);
  });
});

describe("reports/redirects-legacy-2026-09.csv", () => {
  it("carries Josh's approval marker and the documented columns", () => {
    expect(approved).toBe(true);
    expect(csvText.split("\n")[0]).toBe("# approved-by: josh (auto-approve directive in session, 2026-09-23)");
    for (const col of ["from_path", "to_path", "previous_to_path", "match_method", "confidence", "sources",
      "referring_domains", "applied", "reason"]) {
      expect(header).toContain(col);
    }
  });

  it("only applies high-confidence rows", () => {
    expect(applied.length).toBeGreaterThan(0);
    for (const r of applied) expect(r.confidence, r.from_path).toBe("high");
  });

  it("every applied insert has a canonical, non-live from_path and a same-site target", () => {
    for (const r of inserts) {
      expect(fromPathProblem(r.from_path), r.from_path).toBeNull();
      expect(r.to_path.startsWith("/") && !r.to_path.startsWith("//"), r.to_path).toBe(true);
    }
  });

  it("has no duplicate from_paths, loops, or chains among applied rows", () => {
    const froms = applied.map((r) => r.from_path);
    expect(new Set(froms).size).toBe(froms.length);
    const sources = new Set(froms);
    for (const r of applied) {
      expect(key(r.to_path), `${r.from_path} loops`).not.toBe(r.from_path);
      expect(sources.has(key(r.to_path)), `${r.from_path} → ${r.to_path} chains`).toBe(false);
    }
  });

  it("never redirects /search (the live noindex search page)", () => {
    expect(applied.find((r) => key(r.from_path) === "/search")).toBeUndefined();
  });

  it("repoints record the previous target so they can be reverted", () => {
    for (const r of repoints) {
      expect(r.previous_to_path).not.toBe(r.to_path);
      expect(r.match_method).toMatch(/^repoint-/);
    }
  });
});
