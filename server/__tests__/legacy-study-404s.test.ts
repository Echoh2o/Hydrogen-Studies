import { describe, it, expect, vi } from "vitest";

vi.mock("../db", () => ({ pool: {} }));
const { matchStudy, normalizePath } = await import("../../scripts/consolidation/legacy-study-404s");

const S = (id: number, slug: string, extra: Partial<{ title: string; pmid: string; is_excluded: boolean }> = {}) => ({
  id,
  slug,
  title: extra.title ?? null,
  pmid: extra.pmid ?? null,
  doi: null,
  is_excluded: extra.is_excluded ?? false,
});

const studies = [
  S(3332, "hydrogen-prevents-lipopolysaccharide-induced-pulmonary-microvascular-endothelial-cell-injury-by-inhibiting-store-operated-ca2-entry-regulated-by-stim1orai1-pmid-38010088", { pmid: "38010088" }),
  S(3534, "comparison-of-the-antimicrobial-effect-of-hydrogen-water-and-chlorhexidine-mouth-rinse-in-toothbrush-disinfection-among-dental-students-pmid-40511014", { pmid: "40511014" }),
  S(10, "hydrogen-water-and-sleep-quality-pmid-111111"),
  S(11, "hydrogen-water-and-sleep-quality-in-adults-pmid-222222"),
];

describe("legacy study 404 matching", () => {
  it("matches a pre-normalization slug by its title words", () => {
    const m = matchStudy("hydrogen-prevents-lipopolysaccharide-induced-pulmonary-microvascular-endothelial-cell-injury-by-inhibiting-store-operated-ca2-entry-regulated-by-stim1-orai1", studies);
    expect(m).toMatchObject({ match: "same-title", study: { id: 3332 } });
  });

  it("matches a truncated slug to the one study it is a prefix of", () => {
    const m = matchStudy("comparison-of-the-antimicrobial-effect-of-hydrogen-water-and-chlorhexidine-mouth", studies);
    expect(m).toMatchObject({ match: "truncated", study: { id: 3534 } });
  });

  it("matches by a PMID suffix even when the title words changed", () => {
    expect(matchStudy("some-old-title-pmid-40511014", studies)).toMatchObject({ match: "id-suffix", study: { id: 3534 } });
  });

  it("proposes nothing when a short or ambiguous prefix fits several studies", () => {
    expect(matchStudy("hydrogen-water-and-sleep", studies)).toBeNull();
  });

  it("normalizes paths and ignores anything that isn't a single study slug", () => {
    expect(normalizePath("/Study/Foo-Bar/?utm=x")).toBe("/study/foo-bar");
    expect(normalizePath("/study/foo/bar")).toBeNull();
  });
});
