/**
 * Re-audit 2026-09-28 — hub pages as a BROWSER renders them.
 *  #3 /explore-by-mechanism/:mechanism rendered an empty H1, a broken title,
 *     no canonical and "No studies found" (the page read
 *     useRoute("/mechanisms/:slug")). It must match the crawler HTML: same
 *     title, H1, canonical and study list.
 *  #4 life-stage hubs canonicalized to /life-stage/<slug> (a 404); the
 *     canonical must be the sitemap URL /explore-by-life-stage/<slug>.
 *  #9 no "No abstract available" placeholder in hub study cards.
 *
 * 2026-09-28 (owner: "fix the no studies found bug") — the same bug on the
 * demographic and delivery-method hubs: /explore-by-demographic/:demographic
 * read useRoute("/demographics/:slug") and both detail pages read taxonomy
 * tables that are empty in production. Detail pages must match the crawler
 * (title, H1, canonical, study list); the index pages must link exactly the
 * hubs the crawler index links (GET /api/explore/:type/hubs).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import {
  BENEFIT_HUB_SLUGS,
  DEMOGRAPHIC_HUB_SLUGS,
  DELIVERY_METHOD_HUB_SLUGS,
  exploreDetailCopy,
  exploreDetailMeta,
  exploreIndexCopy,
  mechanismHubMeta,
} from "@shared/explore-hubs";

vi.mock("@/components/layout/SiteHeader", () => ({ default: () => null }));

import { getQueryFn } from "@/lib/queryClient";
import ExploreByMechanismPage, { MechanismDetailPage } from "../ExploreByMechanism";
import LifeStageCategoryPage from "../LifeStageCategoryPage";
import ExploreByDemographicPage, { DemographicDetailPage } from "../ExploreByDemographic";
import ExploreByDeliveryMethodPage, { DeliveryMethodDetailPage } from "../ExploreByDeliveryMethod";
import ExploreByBenefit, { BenefitDetailPage } from "../ExploreByBenefit";
import ExploreByLifeStage from "../ExploreByLifeStage";
import ExploreByCondition from "../ExploreByCondition";
import ConditionCategoryPage from "../ConditionCategoryPage";
import ExploreByBodySystem from "../ExploreByBodySystem";
import ExploreHubGate from "@/components/explore/ExploreHubGate";

function renderAt(path: string, pattern: string, component: any) {
  const { hook } = memoryLocation({ path });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, queryFn: getQueryFn({ on401: "throw" }) } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Router hook={hook}>
        <Route path={pattern} component={component} />
      </Router>
    </QueryClientProvider>,
  );
}

const canonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute("href");
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MechanismDetailPage (/explore-by-mechanism/:mechanism)", () => {
  const studies = [
    { slug: "h2-water-trial-1", title: "Hydrogen water trial", publish_year: 2025, journal: "J A" },
    { slug: "h2-water-trial-2", title: "Hydrogen water in rats", publish_year: null, journal: null },
  ];

  it.each(["hydrogen-water", "hydrogen-inhalation", "hydrogen-rich-saline", "hydrogen-bath", "topical-hydrogen", "hydrogen-gas"])(
    "%s: H1, title and canonical match the crawler HTML",
    async (slug) => {
      fetchMock.mockImplementation(async () => new Response(JSON.stringify({ studies }), { status: 200 }));
      renderAt(`/explore-by-mechanism/${slug}`, "/explore-by-mechanism/:mechanism", MechanismDetailPage);

      const { h1 } = exploreDetailCopy(slug);
      expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(h1);
      await waitFor(() => expect(document.title).toBe(mechanismHubMeta(slug).title));
      await waitFor(() => expect(canonical()).toBe(`https://hydrogenstudies.com/explore-by-mechanism/${slug}`));
      expect(fetchMock).toHaveBeenCalledWith(`/api/explore/mechanism/${slug}/studies`, expect.anything());
    },
  );

  it("lists the same studies as the crawler page, linking /study/<slug>", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ studies }), { status: 200 }));
    const { container } = renderAt("/explore-by-mechanism/hydrogen-water", "/explore-by-mechanism/:mechanism", MechanismDetailPage);
    expect(await screen.findByText("Hydrogen water trial")).toBeInTheDocument();
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="/study/"]')).map((a) => a.getAttribute("href"));
    expect(links).toEqual(["/study/h2-water-trial-1", "/study/h2-water-trial-2"]);
    expect(screen.queryByText(/No studies found/i)).toBeNull();
  });
});

describe("LifeStageCategoryPage (/explore-by-life-stage/:category)", () => {
  it("canonical is the sitemap URL, never /life-stage/<slug>", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
    );
    renderAt("/explore-by-life-stage/adults", "/explore-by-life-stage/:category", LifeStageCategoryPage);
    await waitFor(() => expect(canonical()).toBe("https://hydrogenstudies.com/explore-by-life-stage/adults"));
    expect(document.head.innerHTML).not.toContain("hydrogenstudies.com/life-stage/");
  });

  it("omits the excerpt instead of printing a 'No abstract available' placeholder", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: [
            { id: 1, slug: "s-1", title: "Study one", abstract: "", publishDate: "2024-01-01", journal: "J" },
            { id: 2, slug: "s-2", title: "Study two", abstract: "No abstract available", publishDate: "2024-01-01", journal: "J" },
            { id: 3, slug: "s-3", title: "Study three", abstract: "&lt;b&gt;Background:&lt;/b&gt; Real text.", publishDate: "2024-01-01", journal: "J" },
          ],
        }),
        { status: 200 },
      ),
    );
    renderAt("/explore-by-life-stage/adults", "/explore-by-life-stage/:category", LifeStageCategoryPage);
    expect(await screen.findByText("Study one")).toBeInTheDocument();
    expect(screen.queryByText(/No abstract available/i)).toBeNull();
    expect(screen.getByText("Background: Real text.")).toBeInTheDocument();
  });
});

// ── Demographic + delivery-method hubs ──────────────────────────

const hubStudies = [
  { slug: "athletes-trial-1", title: "Hydrogen water in elite athletes", publish_year: 2024, journal: "J A" },
  { slug: "athletes-trial-2", title: "H2 inhalation and sprint recovery", publish_year: null, journal: null },
];

function respondJson(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

const hrefsIn = (container: HTMLElement, selector: string) =>
  Array.from(container.querySelectorAll<HTMLAnchorElement>(selector)).map((a) => a.getAttribute("href"));

describe.each([
  {
    type: "demographic" as const,
    slugs: DEMOGRAPHIC_HUB_SLUGS,
    pattern: "/explore-by-demographic/:demographic",
    Page: DemographicDetailPage,
  },
  {
    type: "delivery-method" as const,
    slugs: DELIVERY_METHOD_HUB_SLUGS,
    pattern: "/explore-by-delivery-method/:method",
    Page: DeliveryMethodDetailPage,
  },
])("$type detail hub (/explore-by-$type/:slug)", ({ type, slugs, pattern, Page }) => {
  it.each([...slugs])("%s: H1, title and canonical match the crawler HTML", async (slug) => {
    fetchMock.mockImplementation(async () => respondJson({ studies: hubStudies }));
    renderAt(`/explore-by-${type}/${slug}`, pattern, Page);

    const { h1, intro } = exploreDetailCopy(slug);
    const meta = exploreDetailMeta(type, slug);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(h1);
    expect(screen.getByText(intro)).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe(meta.title));
    await waitFor(() => expect(canonical()).toBe(`https://hydrogenstudies.com/explore-by-${type}/${slug}`));
    expect(fetchMock).toHaveBeenCalledWith(`/api/explore/${type}/${slug}/studies`, expect.anything());
  });

  it("lists the crawler's studies from the shared endpoint — never 'No studies found'", async () => {
    fetchMock.mockImplementation(async () => respondJson({ studies: hubStudies }));
    const { container } = renderAt(`/explore-by-${type}/${slugs[0]}`, pattern, Page);
    expect(await screen.findByText("Hydrogen water in elite athletes")).toBeInTheDocument();
    expect(hrefsIn(container, 'a[href^="/study/"]')).toEqual(["/study/athletes-trial-1", "/study/athletes-trial-2"]);
    expect(screen.getByText("(2024)")).toBeInTheDocument();
    expect(screen.queryByText(/No studies found/i)).toBeNull();
    // The old taxonomy-table endpoints (empty in production) are gone.
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => /^\/api\/(demographics|delivery-methods)\//.test(u))).toBe(false);
  });

  it("renders no placeholder text when the hub lists no studies", async () => {
    fetchMock.mockImplementation(async () => respondJson({ studies: [] }));
    renderAt(`/explore-by-${type}/${slugs[0]}`, pattern, Page);
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
    expect(screen.queryByText(/No studies found|No clinical studies|No preclinical/i)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Research Studies" })).toBeNull();
  });

  it("reserves the viewport while the list loads (CLS)", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    renderAt(`/explore-by-${type}/${slugs[0]}`, pattern, Page);
    await screen.findByRole("heading", { level: 1 });
    const busy = document.querySelector('[aria-busy="true"]');
    expect(busy).not.toBeNull();
    expect(busy!.className).toContain("min-h-screen");
  });

  it("lowercases the slug for the API call and canonical", async () => {
    fetchMock.mockImplementation(async () => respondJson({ studies: [] }));
    renderAt(`/explore-by-${type}/${slugs[0].toUpperCase()}`, pattern, Page);
    await waitFor(() => expect(canonical()).toBe(`https://hydrogenstudies.com/explore-by-${type}/${slugs[0]}`));
    expect(fetchMock).toHaveBeenCalledWith(`/api/explore/${type}/${slugs[0]}/studies`, expect.anything());
  });
});

describe("DeliveryMethodDetailPage — no sponsor block the crawler never sees", () => {
  it("/explore-by-delivery-method/echoh-flask renders no Echo Flask sales block", async () => {
    fetchMock.mockImplementation(async () => respondJson({ studies: [] }));
    renderAt("/explore-by-delivery-method/echoh-flask", "/explore-by-delivery-method/:method", DeliveryMethodDetailPage);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(/Shop Echo Flask/i)).toBeNull();
    expect(screen.queryByText(/Gold Standard/i)).toBeNull();
  });
});

describe("ExploreByDemographicPage (/explore-by-demographic)", () => {
  const hubs = [
    { slug: "athletes", name: "Athletes", path: "/explore-by-demographic/athletes", studyCount: 12 },
    { slug: "older-adults", name: "Older Adults", path: "/explore-by-demographic/older-adults", studyCount: 1 },
  ];

  it("links exactly the crawler index's hubs, at /explore-by-demographic/<slug>", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/explore/demographic/hubs" ? respondJson({ hubs }) : respondJson({}),
    );
    const { container } = renderAt("/explore-by-demographic", "/explore-by-demographic", ExploreByDemographicPage);
    expect(await screen.findByText("Athletes")).toBeInTheDocument();
    expect(hrefsIn(container, 'a[href^="/explore-by-demographic/"]')).toEqual(hubs.map((h) => h.path));
    expect(container.querySelector('a[href^="/demographics/"]')).toBeNull();
    expect(screen.getByText("12 studies")).toBeInTheDocument();
    expect(screen.getByText("1 study")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/explore/demographic/hubs", expect.anything());
  });

  it("title, H1 and canonical match the crawler index", async () => {
    fetchMock.mockImplementation(async () => respondJson({ hubs: [] }));
    renderAt("/explore-by-demographic", "/explore-by-demographic", ExploreByDemographicPage);
    const copy = exploreIndexCopy("demographic");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(copy.h1);
    await waitFor(() => expect(document.title).toBe(copy.title));
    await waitFor(() => expect(canonical()).toBe("https://hydrogenstudies.com/explore-by-demographic"));
  });
});

describe("ExploreByDeliveryMethodPage (/explore-by-delivery-method)", () => {
  const hubs = [
    { slug: "drinking-water", name: "Drinking Water", path: "/explore-by-delivery-method/drinking-water", studyCount: 12 },
    { slug: "inhalation", name: "Inhalation", path: "/explore-by-delivery-method/inhalation", studyCount: 100 },
    { slug: "bathing", name: "Bathing", path: "/explore-by-delivery-method/bathing", studyCount: 5 },
  ];

  it("links every crawler-index hub exactly once, grouped", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/explore/delivery-method/hubs" ? respondJson({ hubs }) : respondJson({}),
    );
    const { container } = renderAt("/explore-by-delivery-method", "/explore-by-delivery-method", ExploreByDeliveryMethodPage);
    expect(await screen.findByText("Drinking Water")).toBeInTheDocument();
    const links = hrefsIn(container, 'a[href^="/explore-by-delivery-method/"]');
    expect([...links].sort()).toEqual(hubs.map((h) => h.path).sort());
    // The three group cards still render (E2E: "shows three primary delivery method groups").
    expect(screen.getByText("Hydrogen Water")).toBeInTheDocument();
    expect(screen.getByText("Hydrogen Inhalation")).toBeInTheDocument();
    expect(screen.getByText("Other Methods")).toBeInTheDocument();
    expect(screen.queryByText(/^0 studies$/)).toBeNull();
    const copy = exploreIndexCopy("delivery-method");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(copy.h1);
    await waitFor(() => expect(document.title).toBe(copy.title));
  });
});

// ── Benefit hubs + unknown-hub NotFound (2026-09-28, hub-404 change) ──
//
// /explore-by-benefit/:slug rendered for crawlers but had no browser route.
// Unknown hub slugs must render the site's NotFound (noindex) — the server
// sends those URLs with HTTP 404 and the explore APIs answer 404.

function respond404() {
  return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
}

const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute("content");

describe("BenefitDetailPage (/explore-by-benefit/:benefit)", () => {
  it.each([...BENEFIT_HUB_SLUGS])("%s: H1, intro, title and canonical match the crawler HTML", async (slug) => {
    fetchMock.mockImplementation(async () => respondJson({ studies: hubStudies }));
    renderAt(`/explore-by-benefit/${slug}`, "/explore-by-benefit/:benefit", BenefitDetailPage);

    const { h1, intro } = exploreDetailCopy(slug);
    const meta = exploreDetailMeta("benefit", slug);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(h1);
    expect(screen.getByText(intro)).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe(meta.title));
    await waitFor(() => expect(canonical()).toBe(`https://hydrogenstudies.com/explore-by-benefit/${slug}`));
    expect(fetchMock).toHaveBeenCalledWith(`/api/explore/benefit/${slug}/studies`, expect.anything());
  });

  it("lists the crawler's studies from the shared endpoint", async () => {
    fetchMock.mockImplementation(async () => respondJson({ studies: hubStudies }));
    const { container } = renderAt("/explore-by-benefit/antioxidant", "/explore-by-benefit/:benefit", BenefitDetailPage);
    expect(await screen.findByText("Hydrogen water in elite athletes")).toBeInTheDocument();
    expect(hrefsIn(container, 'a[href^="/study/"]')).toEqual(["/study/athletes-trial-1", "/study/athletes-trial-2"]);
    // Breadcrumb parent = the crawler's ("Benefits" → /explore-by-benefit).
    expect(hrefsIn(container, 'a[href="/explore-by-benefit"]').length).toBeGreaterThan(0);
  });

  it("reserves the viewport while the list loads (CLS)", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    renderAt("/explore-by-benefit/antioxidant", "/explore-by-benefit/:benefit", BenefitDetailPage);
    await screen.findByRole("heading", { level: 1 });
    expect(document.querySelector('[aria-busy="true"]')!.className).toContain("min-h-screen");
  });
});

describe.each([
  { label: "benefit", url: "/explore-by-benefit/xyzzy", pattern: "/explore-by-benefit/:benefit", Page: BenefitDetailPage },
  { label: "demographic", url: "/explore-by-demographic/xyzzy", pattern: "/explore-by-demographic/:demographic", Page: DemographicDetailPage },
  { label: "delivery-method", url: "/explore-by-delivery-method/tablets", pattern: "/explore-by-delivery-method/:method", Page: DeliveryMethodDetailPage },
  { label: "mechanism", url: "/explore-by-mechanism/antioxidant", pattern: "/explore-by-mechanism/:mechanism", Page: MechanismDetailPage },
])("unknown $label hub", ({ url, pattern, Page }) => {
  it("renders the site's NotFound page with noindex — never an empty hub", async () => {
    fetchMock.mockImplementation(async () => respond404());
    renderAt(url, pattern, Page);
    expect(await screen.findByRole("heading", { level: 1, name: "Page Not Found" })).toBeInTheDocument();
    await waitFor(() => expect(robots()).toBe("noindex, follow"));
    expect(screen.queryByText(/Hydrogen Therapy Research$/)).toBeNull();
    // A 404 is an answer, not a transient error: no retry.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("ExploreHubGate (condition / body-system / life-stage hub pages)", () => {
  function Child() {
    return <h1>Real hub page</h1>;
  }
  const gated = (type: "condition" | "body-system" | "life-stage") =>
    function Gated({ params }: { params: { slug: string } }) {
      return (
        <ExploreHubGate type={type} slug={params.slug}>
          <Child />
        </ExploreHubGate>
      );
    };

  it.each([
    ["condition", "general-health-conditions"],
    ["body-system", "molecular"],
    ["life-stage", "adolescents"],
  ] as const)("%s/%s: a 404 from /api/explore/:type/:slug renders NotFound (noindex)", async (type, slug) => {
    fetchMock.mockImplementation(async () => respond404());
    renderAt(`/explore-by-${type}/${slug}`, `/explore-by-${type}/:slug`, gated(type));
    expect(await screen.findByRole("heading", { level: 1, name: "Page Not Found" })).toBeInTheDocument();
    await waitFor(() => expect(robots()).toBe("noindex, follow"));
    expect(screen.queryByText("Real hub page")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(`/api/explore/${type}/${slug}`, expect.anything());
  });

  it("a real hub renders its page (no waiting on the check)", async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => (resolve = r)));
    renderAt("/explore-by-condition/type-2-diabetes", "/explore-by-condition/:slug", gated("condition"));
    expect(screen.getByText("Real hub page")).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/explore/condition/type-2-diabetes", expect.anything()),
    );
    resolve(respondJson({ type: "condition", slug: "type-2-diabetes", path: "/explore-by-condition/type-2-diabetes" }));
    await waitFor(() => expect(screen.getByText("Real hub page")).toBeInTheDocument());
    expect(screen.queryByText("Page Not Found")).toBeNull();
  });

  it("a server error keeps the page (only a 404 means 'no such hub')", async () => {
    fetchMock.mockImplementation(async () => new Response("boom", { status: 500 }));
    renderAt("/explore-by-condition/type-2-diabetes", "/explore-by-condition/:slug", gated("condition"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText("Real hub page")).toBeInTheDocument();
    expect(screen.queryByText("Page Not Found")).toBeNull();
  });
});

// ── Index pages link exactly the crawler index's hubs ───────────

describe("ExploreByBenefit (/explore-by-benefit)", () => {
  const hubs = [
    { slug: "antioxidant", name: "Antioxidant", path: "/explore-by-benefit/antioxidant", studyCount: 80 },
    { slug: "longevity", name: "Longevity", path: "/explore-by-benefit/longevity", studyCount: 1 },
  ];

  it("links exactly GET /api/explore/benefit/hubs, with counts; title/H1/canonical = crawler index", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/explore/benefit/hubs"
        ? respondJson({ hubs })
        : respondJson({ success: true, data: { condition: [], body_system: [], life_stage: [] } }),
    );
    const { container } = renderAt("/explore-by-benefit", "/explore-by-benefit", ExploreByBenefit);
    expect(await screen.findByText("Antioxidant")).toBeInTheDocument();
    expect(hrefsIn(container, 'a[href^="/explore-by-benefit/"]')).toEqual(hubs.map((h) => h.path));
    expect(screen.getByText("80 studies")).toBeInTheDocument();
    expect(screen.getByText("1 study")).toBeInTheDocument();
    const copy = exploreIndexCopy("benefit");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(copy.h1);
    expect(screen.getByText(copy.intro)).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe(copy.title));
    await waitFor(() => expect(canonical()).toBe("https://hydrogenstudies.com/explore-by-benefit"));
    // The in-page tabs browser is still there (E2E: "shows three categorization tabs").
    expect(screen.getByRole("tab", { name: /condition/i })).toBeInTheDocument();
  });

  it("reserves the hub grid's height while loading (CLS)", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    renderAt("/explore-by-benefit", "/explore-by-benefit", ExploreByBenefit);
    await screen.findByRole("heading", { level: 1 });
    const busy = document.querySelector('[aria-busy="true"]');
    expect(busy!.className).toContain("min-h-[40vh]");
  });
});

describe.each([
  {
    type: "life-stage",
    Page: ExploreByLifeStage,
    hubs: [
      { slug: "pregnancy", name: "Pregnancy", path: "/explore-by-life-stage/pregnancy", studyCount: 17 },
      { slug: "athletes", name: "Athletes", path: "/explore-by-life-stage/athletes", studyCount: 12 },
    ],
    stale: /\/explore-by-life-stage\/(adolescents|older-adults|men|women)/,
  },
  {
    type: "mechanism",
    Page: ExploreByMechanismPage,
    hubs: [
      { slug: "hydrogen-water", name: "Hydrogen Water", path: "/explore-by-mechanism/hydrogen-water", studyCount: 75 },
      { slug: "hydrogen-gas", name: "Hydrogen Gas", path: "/explore-by-mechanism/hydrogen-gas", studyCount: 100 },
    ],
    stale: /\/explore-by-mechanism\/(antioxidant|gene-expression)/,
  },
  {
    type: "condition",
    Page: ExploreByCondition,
    hubs: [
      { slug: "oxidative-stress", name: "Oxidative Stress", path: "/explore-by-condition/oxidative-stress", studyCount: 2356 },
      { slug: "type-2-diabetes", name: "Type 2 Diabetes", path: "/explore-by-condition/type-2-diabetes", studyCount: 265 },
    ],
    stale: /\/explore-by-condition\/heart-disease-hypertension/,
  },
])("/explore-by-$type index", ({ type, Page, hubs, stale }) => {
  it("links only GET /api/explore/:type/hubs (the crawler index's list)", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === `/api/explore/${type}/hubs`
        ? respondJson({ hubs })
        : url === "/api/mechanisms"
          ? respondJson([{ id: 1, slug: "antioxidant", name: "Antioxidant", studyCount: 3 }])
          : respondJson({
              success: true,
              data: {
                condition: [{ name: "Heart Disease & Hypertension", count: 0 }],
                body_system: [],
                life_stage: [{ name: "Adolescents", count: 0 }, { name: "Older Adults", count: 0 }],
              },
            }),
    );
    const { container } = renderAt(`/explore-by-${type}`, `/explore-by-${type}`, Page);
    expect((await screen.findAllByText(hubs[0].name)).length).toBeGreaterThan(0);
    const linked = Array.from(new Set(hrefsIn(container, `a[href^="/explore-by-${type}/"]`)));
    expect(linked.sort()).toEqual(hubs.map((h) => h.path).sort());
    expect(container.innerHTML).not.toMatch(stale);
    expect(fetchMock).toHaveBeenCalledWith(`/api/explore/${type}/hubs`, expect.anything());
  });
});

describe("ExploreByBodySystem (/explore-by-body-system)", () => {
  it("links canonical hubs only — categories without one ('Whole Body', 'Renal System') are not linked", async () => {
    fetchMock.mockImplementation(async () =>
      respondJson({
        success: true,
        data: {
          condition: [],
          life_stage: [],
          body_system: [
            { name: "Cardiovascular System", count: 65 },
            { name: "Nervous System", count: 512 },
            { name: "Renal System", count: 7 },
            { name: "Whole Body", count: 60 },
          ],
        },
      }),
    );
    const { container } = renderAt("/explore-by-body-system", "/explore-by-body-system", ExploreByBodySystem);
    expect(await screen.findByText("Cardiovascular System")).toBeInTheDocument();
    expect(hrefsIn(container, 'a[href^="/explore-by-body-system/"]').sort()).toEqual([
      "/explore-by-body-system/brain-nervous-system",
      "/explore-by-body-system/cardiovascular",
    ]);
    expect(screen.queryByText("Whole Body")).toBeNull();
  });
});

describe("ConditionCategoryPage (/explore-by-condition/:category) — the crawler's study list", () => {
  const payload = {
    hub: { slug: "kidney-health", name: "Kidney Health", description: null },
    studies: [
      { slug: "kidney-1", title: "Hydrogen protects the kidney", publish_year: 2024, journal: "J K", study_type: "animal", excerpt: "Renal injury was reduced." },
      { slug: "kidney-2", title: "H2 in dialysis patients", publish_year: null, journal: null, study_type: null, excerpt: "" },
    ],
  };

  it("lists GET /api/explore/condition/:slug/studies (the shared query), not consumer categories", async () => {
    fetchMock.mockImplementation(async () => respondJson(payload));
    const { container } = renderAt("/explore-by-condition/kidney-health", "/explore-by-condition/:category", ConditionCategoryPage);
    expect(await screen.findByText("Hydrogen protects the kidney")).toBeInTheDocument();
    // kidney-health carries the wave-3 intro (<article>), whose citations
    // link /study/ pages too; the study list is everything outside it.
    const listed = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="/study/"]'))
      .filter((a) => !a.closest("article"))
      .map((a) => a.getAttribute("href"));
    expect(listed).toEqual(["/study/kidney-1", "/study/kidney-2"]);
    expect(screen.getByText("Renal injury was reduced.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/explore/condition/kidney-health/studies", expect.anything());
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.startsWith("/api/consumer-categories/"))).toBe(false);
    // The hub's own name (same as the crawler H1).
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Kidney Health");
    // No placeholder for the study with no year/journal/excerpt.
    expect(container.innerHTML).not.toMatch(/Date unknown|No abstract/i);
  });
});
