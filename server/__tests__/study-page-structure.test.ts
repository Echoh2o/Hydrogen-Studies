/**
 * Structural SEO pass (2026-10-30): study pages link up to their topic hubs,
 * show an evidence label, and their JSON-LD is a MedicalWebPage ABOUT the
 * paper with a BreadcrumbList matching the visible trail.
 */
import { describe, it, expect } from "vitest";
import { studyBreadcrumbs, studyEvidence, studyHubLinks } from "../../shared/study-page";
import { normalizePubDate, studyJsonLd } from "../../shared/seo-markup";

const HUBS = [
  { slug: "kidney-health", name: "Kidney Health" },
  { slug: "oxidative-stress", name: "Oxidative Stress" },
];

describe("studyHubLinks", () => {
  it("links only values that resolve to a hub, conditions before body systems, deduped", () => {
    const links = studyHubLinks(
      {
        healthConditions: ["Kidney Health", "Some Long-Tail Condition", "kidney health"],
        bodySystems: ["Cardiovascular System", "Acid-Base Balance"],
      },
      HUBS,
    );
    expect(links).toEqual([
      { label: "Kidney Health", href: "/explore-by-condition/kidney-health" },
      { label: "Cardiovascular System", href: "/explore-by-body-system/cardiovascular" },
    ]);
  });

  it("returns nothing when no value has a hub", () => {
    expect(studyHubLinks({ healthConditions: ["Nope"], bodySystems: null }, HUBS)).toEqual([]);
  });
});

describe("studyBreadcrumbs", () => {
  it("is Home › Studies › first hub › page", () => {
    expect(studyBreadcrumbs("My Study", [{ label: "Kidney Health", href: "/explore-by-condition/kidney-health" }])).toEqual([
      { label: "Home", href: "/" },
      { label: "Studies", href: "/studies" },
      { label: "Kidney Health", href: "/explore-by-condition/kidney-health" },
      { label: "My Study" },
    ]);
    expect(studyBreadcrumbs("My Study", [])).toHaveLength(3);
  });
});

describe("studyEvidence", () => {
  it("labels designs and adds caveats for non-human work", () => {
    expect(studyEvidence({ studyDesign: "rct", isHumanTrial: true })).toEqual({
      label: "Randomized controlled trial · Human study",
      note: null,
    });
    expect(studyEvidence({ studyDesign: "animal", studyType: "Mouse" })?.label).toBe("Animal study (mouse)");
    expect(studyEvidence({ studyDesign: "in_vitro" })?.note).toMatch(/cells or tissue/);
    expect(studyEvidence({ studyDesign: "meta_analysis" })).toEqual({
      label: "Systematic review or meta-analysis",
      note: null,
    });
  });

  it("never guesses an unknown design", () => {
    expect(studyEvidence({ studyDesign: null, studyType: "clinical" })).toBeNull();
    expect(studyEvidence({ studyDesign: "other" })).toBeNull();
  });
});

describe("normalizePubDate", () => {
  it("repairs the stored YYYY-MM-DD-HH-MM shape and keeps partial dates", () => {
    expect(normalizePubDate("2026-06-20-01-01")).toBe("2026-06-20");
    expect(normalizePubDate("2024-3-5")).toBe("2024-03-05");
    expect(normalizePubDate("2019")).toBe("2019");
    expect(normalizePubDate("2019-13-01")).toBe("2019");
    expect(normalizePubDate("__no_content__")).toBe("");
    expect(normalizePubDate(null)).toBe("");
  });
});

describe("study JSON-LD shape", () => {
  const ld = studyJsonLd(
    {
      title: "Hydrogen suppressed tumor growth",
      plainLanguageTitle: "Hydrogen Gas Slows Lung Cancer Growth",
      authors: "A. One",
      journal: "Sci Rep",
      doi: "10.1038/x",
      pmid: "40000001",
      journalPublishDate: "2026-06-20-01-01",
    },
    {
      canonical: "https://hydrogenstudies.com/study/s",
      siteUrl: "https://hydrogenstudies.com",
      breadcrumbs: studyBreadcrumbs("Hydrogen Gas Slows Lung Cancer Growth", [
        { label: "Lung Health", href: "/explore-by-condition/lung-health" },
      ]),
    },
  );

  it("is a MedicalWebPage about the paper", () => {
    expect(ld["@type"]).toBe("MedicalWebPage");
    expect(ld.name).toBe("Hydrogen Gas Slows Lung Cancer Growth");
    expect(ld.about).toMatchObject({
      "@type": "MedicalScholarlyArticle",
      name: "Hydrogen suppressed tumor growth",
      datePublished: "2026-06-20",
      isPartOf: { "@type": "Periodical", name: "Sci Rep" },
      sameAs: "https://doi.org/10.1038/x",
    });
    expect(ld.about.identifier).toEqual([
      { "@type": "PropertyValue", propertyID: "DOI", value: "10.1038/x" },
      { "@type": "PropertyValue", propertyID: "PMID", value: "40000001" },
    ]);
    expect(ld.publisher["@id"]).toBe("https://hydrogenstudies.com/#organization");
  });

  it("carries a BreadcrumbList matching the visible trail", () => {
    expect(ld.breadcrumb.itemListElement.map((i: any) => [i.position, i.name, i.item])).toEqual([
      [1, "Home", "https://hydrogenstudies.com/"],
      [2, "Studies", "https://hydrogenstudies.com/studies"],
      [3, "Lung Health", "https://hydrogenstudies.com/explore-by-condition/lung-health"],
      [4, "Hydrogen Gas Slows Lung Cancer Growth", undefined],
    ]);
  });
});
