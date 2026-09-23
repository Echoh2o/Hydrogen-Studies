/**
 * Markup compliance (PR A, audit 2026-09-23) — unit tests for the shared
 * helpers both renderers use (bot SSR + SPA):
 *
 *  - bridge policy (PLAN.md Appendix E)            #4
 *  - UTM helper + render-time link rewriter        #10
 *  - <title> builder                               #11
 *  - H1 demotion                                   #9
 *  - retired-blog-link stripping                   #6
 *  - placeholder filtering                         #3
 *  - abstract excerpt + source link                #2
 *  - FAQPage visibility                            #1
 *  - byline + Article JSON-LD                      #12
 *  - /hydrogen-for topic meta                      #7
 */
import { describe, it, expect } from "vitest";
import {
  BRIDGE_ALLOWED_TOPICS,
  isBridgeAllowed,
  resolveBridgeTopic,
} from "../../shared/bridge-policy";
import {
  buildEchoUrl,
  echoProductUrl,
  ECHO_PRODUCTS,
  isEchoUrl,
  pageContextFromPath,
} from "../../shared/echo-products";
import {
  blogRefFromHref,
  demoteH1InHtml,
  rewriteEchoLinksInHtml,
  rewriteEchoLinksInMarkdown,
  stripDeadBlogLinksInHtml,
  stripDeadBlogLinksInMarkdown,
} from "../../shared/content-links";
import {
  abstractExcerpt,
  blogArticleJsonLd,
  blogByline,
  blogPageTitle,
  buildPageTitle,
  cutAtWordBoundary,
  faqPairsIfVisible,
  isPlaceholder,
  parseQaPairs,
  realContent,
  studyDescription,
  studyJsonLd,
  studyPageTitle,
  studySourceLink,
  withoutPlaceholders,
} from "../../shared/seo-markup";
import { HYDROGEN_FOR_TOPICS } from "../../shared/hydrogen-for-topics";

const UTM_RE = (campaign: string, content: string) =>
  new RegExp(
    `utm_source=hydrogenstudies&utm_medium=referral&utm_campaign=${campaign}&utm_content=${content}`,
  );

// ── #4 bridge policy ────────────────────────────────────────────

describe("bridge policy (PLAN.md Appendix E)", () => {
  it.each(["diabetes", "cancer", "cancer-support", "kidney-health", "kidney", "heart-disease",
    "Alzheimer's disease", "lung-health", "brain-health"])(
    "refuses bridges on disease page topic %s",
    (topic) => {
      expect(isBridgeAllowed(topic)).toBe(false);
    },
  );

  it.each(["inflammation", "gut-health", "cognitive-function", "blood-pressure", "anti-aging", "skin-health"])(
    "refuses gray-area topic %s by default",
    (topic) => {
      expect(isBridgeAllowed(topic)).toBe(false);
    },
  );

  it.each(["exercise-recovery", "athletic-performance", "Athletic Performance & Recovery", "hydration",
    "device-guide", "sleep-quality-healthy-adults"])(
    "allows allowlisted topic %s",
    (topic) => {
      expect(isBridgeAllowed(topic)).toBe(true);
    },
  );

  it("defaults to NOT allowed for unknown / empty topics", () => {
    for (const t of [null, undefined, "", "   ", "something-new", "blog", "hydrogen-water"]) {
      expect(isBridgeAllowed(t as any)).toBe(false);
    }
  });

  it("refuses an allowed context that names a disease (defense in depth)", () => {
    expect(isBridgeAllowed("exercise-recovery-in-diabetes-patients")).toBe(false);
    expect(resolveBridgeTopic("hydration-kidney-disease")).toBeNull();
  });

  it("every allowlisted key passes its own check", () => {
    for (const key of BRIDGE_ALLOWED_TOPICS) expect(isBridgeAllowed(key)).toBe(true);
  });
});

// ── #10 UTM helper ──────────────────────────────────────────────

describe("buildEchoUrl / pageContextFromPath (UTM rule)", () => {
  it("tags a store path with page_type + slug", () => {
    const url = buildEchoUrl("/products/echo-flask", { pageType: "blog", slug: "hydrogen-water-ppm-levels" });
    expect(url.startsWith("https://echowater.com/products/echo-flask?")).toBe(true);
    expect(url).toMatch(UTM_RE("blog", "hydrogen-water-ppm-levels"));
  });

  it("replaces stale/placement utm params on an absolute URL and keeps other params", () => {
    const url = buildEchoUrl(
      "https://www.echowater.com/collections/all?variant=1&utm_campaign=footer&utm_content=disclosure&UTM_TERM=x",
      { pageType: "home", slug: "home" },
    );
    expect(url).toContain("variant=1");
    expect(url).not.toMatch(/footer|disclosure|UTM_TERM/i);
    expect(url).toMatch(UTM_RE("home", "home"));
  });

  it("normalizes unsafe page_type/slug values", () => {
    const url = buildEchoUrl("/", { pageType: "Hydrogen For", slug: "Diabetes & Metabolic" });
    expect(url).toMatch(UTM_RE("hydrogen-for", "diabetes-metabolic"));
  });

  it("echoProductUrl goes through the same tagging", () => {
    expect(echoProductUrl(ECHO_PRODUCTS.flask, { pageType: "hydrogen-for", slug: "athletic-performance" }))
      .toMatch(UTM_RE("hydrogen-for", "athletic-performance"));
  });

  it.each([
    ["/", "home", "home"],
    ["/study/h2-and-fatigue-12345", "study", "h2-and-fatigue-12345"],
    ["/blog/hydrogen-water-real-or-fake", "blog", "hydrogen-water-real-or-fake"],
    ["/hub/athletic-performance", "hub", "athletic-performance"],
    ["/hydrogen-for/diabetes", "hydrogen-for", "diabetes"],
    ["/explore-by-condition/inflammation", "condition", "inflammation"],
    ["/about", "about", "about"],
    ["/blog", "blog", "blog"],
  ])("pageContextFromPath(%s) → %s/%s", (path, pageType, slug) => {
    expect(pageContextFromPath(path)).toEqual({ pageType, slug });
  });

  it("isEchoUrl only matches echowater.com hosts", () => {
    expect(isEchoUrl("https://echowater.com")).toBe(true);
    expect(isEchoUrl("//www.echowater.com/products/x")).toBe(true);
    expect(isEchoUrl("https://echowater.com.evil.io/")).toBe(false);
    expect(isEchoUrl("https://hydrogenstudies.com/blog/x")).toBe(false);
    expect(isEchoUrl("/products/echo-flask")).toBe(false);
  });
});

describe("render-time echowater link rewriter", () => {
  const ctx = { pageType: "blog", slug: "my-post" };

  it("tags every echowater.com href in HTML and leaves other links alone", () => {
    const html =
      `<p><a href="https://echowater.com/products/echo-flask">Flask</a> and ` +
      `<a href='https://echowater.com?utm_source=x&amp;utm_campaign=footer'>Echo</a> and ` +
      `<a href="https://pubmed.ncbi.nlm.nih.gov/1/">PubMed</a></p>`;
    const out = rewriteEchoLinksInHtml(html, ctx);
    const hrefs = [...out.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    expect(hrefs).toHaveLength(3);
    expect(hrefs[0]).toMatch(UTM_RE("blog", "my-post"));
    expect(hrefs[1]).toMatch(UTM_RE("blog", "my-post"));
    expect(hrefs[1]).not.toContain("footer");
    expect(hrefs[2]).toBe("https://pubmed.ncbi.nlm.nih.gov/1/");
    // attribute stays HTML-escaped
    expect(out).toContain("&amp;utm_medium=referral");
  });

  it("tags markdown links and autolinks", () => {
    const md = "See [the Flask](https://echowater.com/products/echo-flask) or <https://echowater.com>. Not [this](https://example.com).";
    const out = rewriteEchoLinksInMarkdown(md, ctx);
    expect(out).toMatch(/\[the Flask\]\(https:\/\/echowater\.com\/products\/echo-flask\?utm_source=hydrogenstudies&utm_medium=referral&utm_campaign=blog&utm_content=my-post\)/);
    expect(out).toMatch(/<https:\/\/echowater\.com\/\?utm_source=hydrogenstudies/);
    expect(out).toContain("[this](https://example.com)");
  });
});

// ── #11 titles ──────────────────────────────────────────────────

describe("title builder (≤65 chars, word boundary, no ellipsis)", () => {
  it("appends the site suffix when it fits", () => {
    expect(buildPageTitle("Hydrogen Water and Fatigue")).toBe("Hydrogen Water and Fatigue | Hydrogen Studies");
  });

  it("drops the suffix and cuts at a word boundary for long topics", () => {
    const topic =
      "Effects of Hydrogen-Rich Water on Oxidative Stress Markers in Elderly Participants With Mild Cognitive Impairment";
    const t = buildPageTitle(topic);
    expect(t.length).toBeLessThanOrEqual(65);
    expect(t).not.toMatch(/…|\.\.\.$/);
    expect(topic.startsWith(t)).toBe(true);
    // ends on a whole word, not a dangling stopword
    expect(topic.charAt(t.length)).toBe(" ");
    expect(t).not.toMatch(/\b(of|on|in|with|and|the)$/i);
  });

  it("prefers metaTitle, strips an existing suffix, ignores ellipsis-truncated metaTitle", () => {
    expect(studyPageTitle({ metaTitle: "Hydrogen & Sleep Quality | Hydrogen Studies", title: "Long academic title" }))
      .toBe("Hydrogen & Sleep Quality | Hydrogen Studies");
    expect(blogPageTitle({ metaTitle: "Is Hydrogen Water Worth It? A Review of the Evid…", title: "Is Hydrogen Water Worth It?" }))
      .toBe("Is Hydrogen Water Worth It? | Hydrogen Studies");
  });

  it("never emits a title over 65 chars across realistic inputs", () => {
    const inputs = [
      "A Randomized, Double-Blind, Placebo-Controlled Trial of Hydrogen-Rich Water in Patients With Metabolic Syndrome",
      "Molecular hydrogen: a therapeutic antioxidant and beyond",
      "Supercalifragilisticexpialidocious-hydrogen-water-effects-on-everything-under-the-sun-and-more",
    ];
    for (const i of inputs) {
      const t = buildPageTitle(i);
      expect(t.length).toBeLessThanOrEqual(65);
      expect(t).not.toContain("…");
    }
  });

  it("cutAtWordBoundary never cuts mid-word", () => {
    expect(cutAtWordBoundary("Hydrogen inhalation improves recovery", 20)).toBe("Hydrogen inhalation");
  });
});

// ── #9 H1 demotion ──────────────────────────────────────────────

describe("demoteH1InHtml", () => {
  it("turns every body h1 into h2, keeping attributes", () => {
    const out = demoteH1InHtml(`<h1>Title</h1><p>x</p><H1 id="a" class="b">Again</H1>`);
    expect(out).toBe(`<h2>Title</h2><p>x</p><h2 id="a" class="b">Again</h2>`);
    expect(out).not.toMatch(/<h1/i);
  });

  it("leaves h2/h3 and h10-like tags alone", () => {
    expect(demoteH1InHtml("<h2>a</h2><h3>b</h3>")).toBe("<h2>a</h2><h3>b</h3>");
  });
});

// ── #6 retired blog links ───────────────────────────────────────

describe("dead blog link stripping", () => {
  const live = new Set(["live-post", "42"]);
  const isLive = (ref: string) => live.has(ref);

  it("parses blog refs from relative and absolute URLs", () => {
    expect(blogRefFromHref("/blog/live-post")).toBe("live-post");
    expect(blogRefFromHref("https://www.hydrogenstudies.com/blog/Old-Post/?x=1#h")).toBe("old-post");
    expect(blogRefFromHref("/blog/category/sleep")).toBeNull();
    expect(blogRefFromHref("/blog")).toBeNull();
    expect(blogRefFromHref("/study/x")).toBeNull();
    expect(blogRefFromHref("https://example.com/blog/x")).toBeNull();
  });

  it("unwraps <a> to retired posts, keeps anchor text and live links", () => {
    const html =
      `<p>Read <a href="/blog/retired-post">the old guide</a>, ` +
      `<a href="https://hydrogenstudies.com/blog/live-post">the new one</a>, ` +
      `<a href="/blog/42">by id</a> and <a href="/blog/category/sleep">sleep</a>.</p>`;
    const out = stripDeadBlogLinksInHtml(html, isLive);
    expect(out).toContain("Read the old guide,");
    expect(out).not.toContain("retired-post");
    expect(out).toContain(`<a href="https://hydrogenstudies.com/blog/live-post">the new one</a>`);
    expect(out).toContain(`<a href="/blog/42">by id</a>`);
    expect(out).toContain(`<a href="/blog/category/sleep">sleep</a>`);
  });

  it("unwraps markdown links to retired posts", () => {
    const md = "See [old post](/blog/retired-post \"t\") and [live](https://hydrogenstudies.com/blog/live-post).";
    const out = stripDeadBlogLinksInMarkdown(md, isLive);
    expect(out).toBe("See old post and [live](https://hydrogenstudies.com/blog/live-post).");
  });
});

// ── #3 placeholders ─────────────────────────────────────────────

describe("placeholder filtering", () => {
  it.each(["__no_content__", "__pending__", "", "   ", "N/A", "n/a", "null", "undefined", "-", "—", "TBD"])(
    "treats %j as a placeholder",
    (v) => {
      expect(isPlaceholder(v)).toBe(true);
      expect(realContent(v)).toBe("");
    },
  );

  it("keeps real content (including 'None declared' style facts)", () => {
    expect(isPlaceholder("Hydrogen reduced fatigue scores.")).toBe(false);
    expect(isPlaceholder("None declared")).toBe(false);
    expect(isPlaceholder(0 as any)).toBe(false);
  });

  it("withoutPlaceholders nulls every sentinel string field", () => {
    const s = withoutPlaceholders({ key_finding: "__no_content__", tldr: "Real", country: "N/A", year: 2020 });
    expect(s).toEqual({ key_finding: null, tldr: "Real", country: null, year: 2020 });
  });
});

// ── #2 abstract excerpt ─────────────────────────────────────────

const LONG_ABSTRACT =
  "Background: Molecular hydrogen has been proposed as a selective antioxidant. " +
  "Methods: In this randomized, double-blind, placebo-controlled trial, 120 healthy adults consumed 1.5 L/day of hydrogen-rich water or placebo water for 8 weeks. " +
  "Results: Hydrogen-rich water reduced urinary 8-OHdG by 14% and serum MDA by 9% compared with placebo, with no adverse events. " +
  "Conclusions: Daily intake of hydrogen-rich water may reduce oxidative stress biomarkers in healthy adults; larger trials are warranted to confirm these findings.";

describe("abstract excerpt + source link", () => {
  it("never exceeds 300 chars and ends at a word boundary with an ellipsis", () => {
    expect(LONG_ABSTRACT.length).toBeGreaterThan(300);
    const ex = abstractExcerpt(LONG_ABSTRACT);
    expect(ex.length).toBeLessThanOrEqual(300);
    expect(ex.endsWith("…")).toBe(true);
    const body = ex.slice(0, -1);
    expect(LONG_ABSTRACT.startsWith(body)).toBe(true);
    expect(LONG_ABSTRACT.charAt(body.length)).toMatch(/[\s.,;:]/);
  });

  it("returns short abstracts whole, and nothing for placeholders", () => {
    expect(abstractExcerpt("Short abstract.")).toBe("Short abstract.");
    expect(abstractExcerpt("__no_content__")).toBe("");
    expect(abstractExcerpt(null)).toBe("");
  });

  it("links PubMed first, then DOI, then the source URL", () => {
    expect(studySourceLink({ pmid: "31234567", doi: "10.1/x" })).toEqual({
      href: "https://pubmed.ncbi.nlm.nih.gov/31234567/",
      label: "Read the full abstract on PubMed",
    });
    expect(studySourceLink({ doi: "https://doi.org/10.1000/abc" })).toEqual({
      href: "https://doi.org/10.1000/abc",
      label: "Read the full abstract via DOI",
    });
    expect(studySourceLink({ url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1/" })?.label)
      .toBe("Read the full abstract on PMC");
    expect(studySourceLink({ url: "https://journal.example/article" })?.label)
      .toBe("Read the full abstract at the source");
    expect(studySourceLink({ doi: "__no_content__" })).toBeNull();
  });

  it("study JSON-LD carries no abstract and a ≤300-char description", () => {
    const ld = studyJsonLd(
      { id: 1, slug: "s", title: "T", abstract: LONG_ABSTRACT, authors: "A. One, B. Two", doi: "10.1/x" },
      { canonical: "https://hydrogenstudies.com/study/s", siteUrl: "https://hydrogenstudies.com" },
    );
    expect(ld.abstract).toBeUndefined();
    expect(JSON.stringify(ld)).not.toContain(LONG_ABSTRACT);
    expect(ld.description.length).toBeLessThanOrEqual(300);
    expect(ld["@type"]).toBe("MedicalScholarlyArticle");
    expect(ld.author).toEqual([{ "@type": "Person", name: "A. One" }, { "@type": "Person", name: "B. Two" }]);
  });

  it("studyDescription prefers our own summary over the abstract", () => {
    expect(studyDescription({ summary100Words: "Our summary.", abstract: LONG_ABSTRACT })).toBe("Our summary.");
    expect(studyDescription({ metaDescription: "__no_content__", abstract: LONG_ABSTRACT }).length).toBeLessThanOrEqual(300);
  });
});

// ── #1 FAQ visibility ───────────────────────────────────────────

describe("FAQPage visibility", () => {
  const pairs = parseQaPairs(JSON.stringify([
    { question: "Is hydrogen water safe?", answer: "Generally yes." },
    { q: "How much should I drink?", a: "Studies used 0.5–1.5 L/day." },
  ]));

  it("parses both {question,answer} and {q,a} shapes", () => {
    expect(pairs).toHaveLength(2);
    expect(pairs[1].question).toBe("How much should I drink?");
  });

  it("returns pairs only when every question is visible on the page", () => {
    const visible = "<h2>FAQ</h2><h3>Is hydrogen water safe?</h3><p>…</p><h3>How much should I drink?</h3>";
    expect(faqPairsIfVisible(pairs, visible)).toEqual(pairs);
    expect(faqPairsIfVisible(pairs, "<h3>Is hydrogen water safe?</h3>")).toBeNull();
    expect(faqPairsIfVisible(pairs, "")).toBeNull();
    expect(faqPairsIfVisible([], visible)).toBeNull();
  });

  it("tolerates entity/punctuation differences in the rendered text", () => {
    const qa = [{ question: "What's the ‘right’ dose?", answer: "x" }];
    expect(faqPairsIfVisible(qa, "<h3>What&#39;s the right dose</h3>")).not.toBeNull();
  });
});

// ── #12 byline + Article JSON-LD ────────────────────────────────

describe("blog byline + Article JSON-LD", () => {
  const base = {
    title: "Hydrogen water and sleep",
    createdAt: "2026-01-02T00:00:00Z",
    updatedAt: "2026-03-04T00:00:00Z",
  };
  const opts = {
    canonical: "https://hydrogenstudies.com/blog/sleep",
    siteUrl: "https://hydrogenstudies.com",
    description: "desc",
  };

  it("defaults to the editorial team + Updated date, no reviewer", () => {
    const by = blogByline(base);
    expect(by.author).toBe("Hydrogen Studies Editorial Team");
    expect(by.authorIsPerson).toBe(false);
    expect(by.reviewer).toBeNull();
    expect(by.dateLabel).toBe("Updated");
    expect(by.dateText).toBe("March 4, 2026");
    expect(by.href).toBe("/editorial-policy");

    const ld = blogArticleJsonLd(base, opts);
    expect(ld.author).toEqual({
      "@type": "Organization",
      name: "Hydrogen Studies Editorial Team",
      url: "https://hydrogenstudies.com/editorial-policy",
    });
    expect(ld.dateModified).toBe("2026-03-04T00:00:00.000Z");
    expect(JSON.stringify(ld)).not.toContain("reviewedBy");
  });

  it("does NOT present a machine-stamped last_reviewed as a review without a named reviewer", () => {
    // last_reviewed is auto-stamped at generation time; alone it is not a review.
    const by = blogByline({ ...base, lastReviewed: "2026-09-01T00:00:00Z" });
    expect(by.dateLabel).toBe("Updated");
    expect(by.dateText).toBe("March 4, 2026");
    const ld = blogArticleJsonLd({ ...base, lastReviewed: "2026-09-01T00:00:00Z" }, opts);
    expect(JSON.stringify(ld)).not.toMatch(/reviewedBy|lastReviewed/);
    expect(ld.dateModified).toBe("2026-03-04T00:00:00.000Z");
  });

  it("uses a named author (Person), reviewer and last-reviewed date when set", () => {
    const blog = { ...base, authorName: "Dr. Jane Roe", reviewerName: "John Doe, PhD", lastReviewed: "2026-09-01T00:00:00Z" };
    const by = blogByline(blog);
    expect(by).toMatchObject({ author: "Dr. Jane Roe", authorIsPerson: true, reviewer: "John Doe, PhD", dateLabel: "Last reviewed", dateText: "September 1, 2026" });
    const ld = blogArticleJsonLd(blog, opts);
    expect(ld.author).toEqual({ "@type": "Person", name: "Dr. Jane Roe" });
    expect(ld.mainEntityOfPage.reviewedBy).toEqual({ "@type": "Person", name: "John Doe, PhD" });
    expect(ld.mainEntityOfPage.lastReviewed).toBe("2026-09-01T00:00:00.000Z");
    expect(ld.dateModified).toBe("2026-09-01T00:00:00.000Z");
  });

  it("never invents a reviewer from placeholder values", () => {
    const ld = blogArticleJsonLd({ ...base, reviewerName: "N/A", authorName: "__no_content__" }, opts);
    expect(JSON.stringify(ld)).not.toContain("reviewedBy");
    expect(ld.author["@type"]).toBe("Organization");
  });
});

// ── #7 /hydrogen-for topic meta + #4 wiring ─────────────────────

describe("/hydrogen-for topic records", () => {
  it("has the 10 sitemap slugs with compliant title/description lengths", () => {
    expect(Object.keys(HYDROGEN_FOR_TOPICS).sort()).toEqual([
      "athletic-performance", "brain-health", "cancer-support", "diabetes", "gut-health",
      "heart-disease", "inflammation", "kidney-health", "lung-health", "skin-health",
    ]);
    for (const t of Object.values(HYDROGEN_FOR_TOPICS)) {
      expect(t.metaTitle.length, t.slug).toBeLessThanOrEqual(60);
      expect(t.metaTitle.endsWith(" | Hydrogen Studies"), t.slug).toBe(true);
      expect(t.metaDescription.length, t.slug).toBeGreaterThanOrEqual(140);
      expect(t.metaDescription.length, t.slug).toBeLessThanOrEqual(160);
      expect(t.faqs.length, t.slug).toBeGreaterThan(0);
    }
  });

  it("only athletic-performance is bridge-eligible; disease topics carry no products", () => {
    const allowed = Object.values(HYDROGEN_FOR_TOPICS).filter((t) => isBridgeAllowed(t.bridgeTopic)).map((t) => t.slug);
    expect(allowed).toEqual(["athletic-performance"]);
    for (const t of Object.values(HYDROGEN_FOR_TOPICS)) {
      if (!isBridgeAllowed(t.bridgeTopic)) expect(t.products, t.slug).toEqual([]);
    }
  });
});
