/**
 * Keyword plan wave 3 — /explore-by-condition/<slug> as a BROWSER renders it
 * for the 4 hubs with an evidence-graded intro. Same record as the crawler
 * (server/__tests__/condition-hub-intros.test.ts): title, description, H1,
 * byline, intro, FAQ + FAQPage, sources, study list, owner guide — and none
 * of the old generic copy or the health_conditions description.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { marked } from "marked";
import {
  CONDITION_HUB_FAQ_HEADING,
  CONDITION_HUB_INTROS,
  CONDITION_HUB_OWNER_GUIDE_LEAD,
  CONDITION_HUB_SOURCES_HEADING,
  CONDITION_HUB_STUDIES_HEADING,
} from "@shared/condition-hub-intros";

vi.mock("@/components/layout/SiteHeader", () => ({ default: () => null }));

import { getQueryFn } from "@/lib/queryClient";
import ConditionCategoryPage from "../ConditionCategoryPage";

const SLUGS = ["kidney-health", "chronic-fatigue", "exercise-recovery", "skin-aging"];
const OLD = {
  "kidney-health": { name: "Kidney Health", description: "The functional integrity of the kidneys. Hydrogen may protect against kidney damage from various causes including ischemia and toxins." },
  "chronic-fatigue": { name: "Chronic Fatigue", description: "Persistent exhaustion not relieved by rest. Hydrogen may support energy production through mitochondrial function improvement." },
  "exercise-recovery": { name: "Exercise Recovery", description: "The process of muscle repair and adaptation after physical exercise. Hydrogen water may reduce exercise-induced oxidative stress and accelerate recovery." },
  "skin-aging": { name: "Skin Aging", description: "The progressive deterioration of skin structure and function. Hydrogen water bathing may reduce UV damage and improve skin elasticity." },
} as Record<string, { name: string; description: string }>;

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function payload(slug: string) {
  return {
    hub: { slug, name: OLD[slug].name, description: OLD[slug].description },
    studies: [
      { slug: `${slug}-1`, title: `${OLD[slug].name} trial`, publish_year: 2024, journal: "J A", study_type: "human", excerpt: "An excerpt." },
      { slug: `${slug}-2`, title: `${OLD[slug].name} in rats`, publish_year: null, journal: null, study_type: null, excerpt: "" },
    ],
  };
}

function renderHub(slug: string) {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(payload(slug)), { status: 200 }));
  const { hook } = memoryLocation({ path: `/explore-by-condition/${slug}` });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, queryFn: getQueryFn({ on401: "throw" }) } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Router hook={hook}>
        <Route path="/explore-by-condition/:category" component={ConditionCategoryPage} />
      </Router>
    </QueryClientProvider>,
  );
}

const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const helmetMeta = (selector: string) =>
  Array.from(document.head.querySelectorAll(selector)).map((el) => el.getAttribute("content") ?? el.getAttribute("href"));
const jsonLd = () =>
  Array.from(document.head.querySelectorAll('script[type="application/ld+json"]')).map((s) => JSON.parse(s.textContent || "{}"));

describe.each(SLUGS)("ConditionCategoryPage with an evidence-graded intro — %s", (slug) => {
  const r = CONDITION_HUB_INTROS[slug];

  it("head: record title/description/og/twitter, self canonical, CollectionPage + FAQPage — no generic copy", async () => {
    renderHub(slug);
    await waitFor(() => expect(document.title).toBe(r.metaTitle));
    expect(helmetMeta('meta[name="description"]')).toContain(r.metaDescription);
    expect(helmetMeta('meta[property="og:title"]')).toContain(r.metaTitle);
    expect(helmetMeta('meta[property="og:description"]')).toContain(r.metaDescription);
    expect(helmetMeta('meta[name="twitter:description"]')).toContain(r.metaDescription);
    expect(helmetMeta('link[rel="canonical"]')).toEqual([`https://hydrogenstudies.com/explore-by-condition/${slug}`]);
    expect(document.head.innerHTML).not.toMatch(/may benefit and treat|to treat|keywords/i);
    const ld = jsonLd();
    expect(ld.map((x) => x["@type"]).sort()).toEqual(["CollectionPage", "FAQPage"]);
    const faq = ld.find((x) => x["@type"] === "FAQPage");
    expect(faq.mainEntity.map((q: any) => q.name)).toEqual(r.faqs.map((f) => f.question));
  });

  it("one H1 = record.h1, then the byline; the old description and generic intro are gone", async () => {
    const { container } = renderHub(slug);
    await screen.findByText(`${OLD[slug].name} trial`);
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(norm(h1s[0].textContent)).toBe(r.h1);
    const byline = container.querySelector("p.byline")!;
    expect(norm(byline.textContent)).toBe("By Hydrogen Studies Editorial Team · Updated September 29, 2026");
    expect(byline.querySelector("time")!.getAttribute("datetime")).toBe(`${r.lastReviewed}T00:00:00.000Z`);
    const text = norm(container.textContent);
    expect(text).not.toContain(OLD[slug].description);
    expect(text).not.toMatch(/Explore scientific research investigating|Last reviewed|Reviewed by/);
  });

  it("intro: same text and links as the crawler's markdown → HTML, no raw markdown", async () => {
    const { container } = renderHub(slug);
    const intro = container.querySelector(".hub-intro") as HTMLElement;
    const crawler = document.createElement("div");
    crawler.innerHTML = marked.parse(r.introMarkdown, { async: false }) as string;
    expect(norm(intro.textContent)).toBe(norm(crawler.textContent));
    const hrefs = (el: Element) => Array.from(el.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs(intro)).toEqual(hrefs(crawler));
    expect(intro.querySelectorAll("h2")).toHaveLength((r.introMarkdown.match(/^## /gm) ?? []).length);
    expect(intro.querySelector("h1")).toBeNull();
    expect(intro.textContent).not.toMatch(/\*\*|\]\(/);
  });

  it("visible FAQ (H2 + H3 questions + answers) and numbered sources", async () => {
    const { container } = renderHub(slug);
    const faq = container.querySelector('section[aria-labelledby="faq"]') as HTMLElement;
    expect(within(faq).getByRole("heading", { level: 2 })).toHaveTextContent(CONDITION_HUB_FAQ_HEADING);
    expect(within(faq).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(r.faqs.map((f) => f.question));
    for (const f of r.faqs) expect(within(faq).getByText(f.answer)).toBeInTheDocument();

    const sources = container.querySelector('section[aria-labelledby="sources"]') as HTMLElement;
    expect(within(sources).getByRole("heading", { level: 2 })).toHaveTextContent(CONDITION_HUB_SOURCES_HEADING);
    const items = sources.querySelectorAll("ol > li");
    expect(items).toHaveLength(r.sources.length);
    r.sources.forEach((s, i) => {
      expect(items[i].id).toBe(`source-${s.n}`);
      expect(items[i].textContent).toContain(s.citation);
      const hrefs = Array.from(items[i].querySelectorAll("a")).map((a) => a.getAttribute("href"));
      if (s.pmid) expect(hrefs).toContain(`https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/`);
      if (s.ourStudyPath) expect(hrefs).toContain(s.ourStudyPath);
    });
  });

  it("then the study list (shared endpoint), then the owner guide; no product content", async () => {
    const { container } = renderHub(slug);
    await screen.findByText(`${OLD[slug].name} trial`);
    expect(fetchMock).toHaveBeenCalledWith(`/api/explore/condition/${slug}/studies`, expect.anything());
    const html = container.innerHTML;
    const at = (needle: string) => {
      const i = html.indexOf(needle);
      expect(i, needle).toBeGreaterThan(-1);
      return i;
    };
    const order = [
      at("<h1"),
      at('class="hub-intro'),
      at('id="faq"'),
      at('id="sources"'),
      at(`>${CONDITION_HUB_STUDIES_HEADING}</h2>`),
      at(`${OLD[slug].name} trial`),
      at(`${CONDITION_HUB_OWNER_GUIDE_LEAD}</strong>`),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(screen.getByText("2 studies in our database.")).toBeInTheDocument();
    const owner = screen.getByRole("link", { name: r.ownerLink.label });
    expect(owner).toHaveAttribute("href", r.ownerLink.href);
    // No sponsor/product module: the page body has no echowater links at all
    // (the footer's ownership disclosure is the only one on the page).
    const main = html.slice(0, html.indexOf("<footer"));
    expect(main).not.toMatch(/echowater\.com|rel="sponsored/);
    expect(html).not.toMatch(/__no_content__|No abstract/);
  });
});

describe("ConditionCategoryPage without an intro record keeps its rendering", () => {
  it("type-2-diabetes: generic H1/intro, no byline, FAQ or sources", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            hub: { slug: "type-2-diabetes", name: "Type 2 Diabetes", description: null },
            studies: [{ slug: "t2d-1", title: "T2D trial", publish_year: 2024, journal: "J", study_type: "human", excerpt: "" }],
          }),
          { status: 200 },
        ),
    );
    const { hook } = memoryLocation({ path: "/explore-by-condition/type-2-diabetes" });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: getQueryFn({ on401: "throw" }) } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <Router hook={hook}>
          <Route path="/explore-by-condition/:category" component={ConditionCategoryPage} />
        </Router>
      </QueryClientProvider>,
    );
    await screen.findByText("T2D trial");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Hydrogen Studies for Type 2 Diabetes");
    expect(container.querySelector("p.byline")).toBeNull();
    expect(container.querySelector('section[aria-labelledby="faq"]')).toBeNull();
    expect(container.querySelector('section[aria-labelledby="sources"]')).toBeNull();
    await waitFor(() => expect(document.title).toMatch(/Type 2 Diabetes/));
    expect(jsonLd().map((x) => x["@type"])).toEqual(["CollectionPage"]);
  });
});
