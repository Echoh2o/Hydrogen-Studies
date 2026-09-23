/**
 * /hydrogen-for/:slug — PLAN.md Appendix E bridge placement.
 *  - Disease topics (diabetes, cancer-support, kidney-health…) render NO
 *    product content: no sponsor cards, no store link, no "Compare Products".
 *  - Allowlisted topics (athletic-performance) render a labeled sponsor card
 *    whose links carry this page's UTMs and rel="sponsored".
 *  - The visible FAQ still renders everywhere (it backs the FAQPage schema).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { memoryLocation } from "wouter/memory-location";

vi.mock("@/components/layout/SiteHeader", () => ({ default: () => null }));

import HydrogenForConditionPage from "../HydrogenForConditionPage";

function renderAt(path: string) {
  const { hook } = memoryLocation({ path });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Router hook={hook}>
        <Route path="/hydrogen-for/:condition" component={HydrogenForConditionPage} />
      </Router>
    </QueryClientProvider>,
  );
}

const storeLinks = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLAnchorElement>("a[href]")).filter((a) =>
    /echowater\.com/i.test(a.getAttribute("href") || ""),
  );

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HydrogenForConditionPage bridge policy", () => {
  it.each(["diabetes", "cancer-support", "kidney-health", "inflammation", "gut-health"])(
    "renders no product content on /hydrogen-for/%s",
    async (slug) => {
      const { container } = renderAt(`/hydrogen-for/${slug}`);
      await screen.findByText("Frequently Asked Questions");
      expect(screen.queryByText("From our sponsor, Echo Water")).toBeNull();
      expect(screen.queryByText("Shop Echo Water")).toBeNull();
      expect(screen.queryByText("Compare Products")).toBeNull();
      // Only the footer ownership disclosure may link to echowater.com — never a PDP.
      for (const a of storeLinks(container)) {
        expect(a.getAttribute("href")).not.toMatch(/\/products\//);
      }
      expect(container.querySelector('a[href="/products"]')).toBeNull();
    },
  );

  it("renders a labeled, UTM-tagged sponsor card on an allowlisted topic", async () => {
    const { container } = renderAt("/hydrogen-for/athletic-performance");
    expect(await screen.findByText("From our sponsor, Echo Water")).toBeInTheDocument();
    const productLinks = storeLinks(container).filter((a) =>
      /\/products\//.test(a.getAttribute("href") || ""),
    );
    expect(productLinks.length).toBeGreaterThan(0);
    for (const a of productLinks) {
      const url = new URL(a.getAttribute("href")!);
      expect(url.searchParams.get("utm_campaign")).toBe("hydrogen-for");
      expect(url.searchParams.get("utm_content")).toBe("athletic-performance");
      expect(a.getAttribute("rel")).toContain("sponsored");
    }
    // No fabricated ratings on sponsor cards.
    expect(screen.queryByText("Top Rated")).toBeNull();
  });
});
