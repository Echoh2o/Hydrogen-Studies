/**
 * Re-audit 2026-09-28 — hub pages as a BROWSER renders them.
 *  #3 /explore-by-mechanism/:mechanism rendered an empty H1, a broken title,
 *     no canonical and "No studies found" (the page read
 *     useRoute("/mechanisms/:slug")). It must match the crawler HTML: same
 *     title, H1, canonical and study list.
 *  #4 life-stage hubs canonicalized to /life-stage/<slug> (a 404); the
 *     canonical must be the sitemap URL /explore-by-life-stage/<slug>.
 *  #9 no "No abstract available" placeholder in hub study cards.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { exploreDetailCopy, mechanismHubMeta } from "@shared/explore-hubs";

vi.mock("@/components/layout/SiteHeader", () => ({ default: () => null }));

import { getQueryFn } from "@/lib/queryClient";
import { MechanismDetailPage } from "../ExploreByMechanism";
import LifeStageCategoryPage from "../LifeStageCategoryPage";

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
