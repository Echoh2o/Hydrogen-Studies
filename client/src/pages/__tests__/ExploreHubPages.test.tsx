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
  DEMOGRAPHIC_HUB_SLUGS,
  DELIVERY_METHOD_HUB_SLUGS,
  exploreDetailCopy,
  exploreDetailMeta,
  exploreIndexCopy,
  mechanismHubMeta,
} from "@shared/explore-hubs";

vi.mock("@/components/layout/SiteHeader", () => ({ default: () => null }));

import { getQueryFn } from "@/lib/queryClient";
import { MechanismDetailPage } from "../ExploreByMechanism";
import LifeStageCategoryPage from "../LifeStageCategoryPage";
import ExploreByDemographicPage, { DemographicDetailPage } from "../ExploreByDemographic";
import ExploreByDeliveryMethodPage, { DeliveryMethodDetailPage } from "../ExploreByDeliveryMethod";

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
    renderAt("/explore-by-life-stage/elderly-aging", "/explore-by-life-stage/:category", LifeStageCategoryPage);
    await waitFor(() => expect(canonical()).toBe("https://hydrogenstudies.com/explore-by-life-stage/elderly-aging"));
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
