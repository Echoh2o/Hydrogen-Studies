/**
 * Global footer — PLAN.md Appendix E + CLAUDE.md UTM rule.
 *  - No product/store links (the footer renders on disease pages too).
 *  - The ownership disclosure still links to echowater.com, tagged with the
 *    CURRENT page's utm_campaign (page type) and utm_content (slug).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import Footer from "../Footer";

function renderAt(path: string) {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <Footer />
    </Router>,
  );
}

function echoLinks(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll<HTMLAnchorElement>("a[href]")).filter((a) =>
    /echowater\.com/i.test(a.getAttribute("href") || ""),
  );
}

describe("Footer", () => {
  it("renders no Echo product / store links (Appendix E)", () => {
    const { container } = renderAt("/hydrogen-for/diabetes");
    for (const a of echoLinks(container)) {
      expect(a.getAttribute("href")).not.toMatch(/\/products\//);
    }
    // The old "Echo Water" column (Flask / Ultimate / Refresh) is gone.
    expect(screen.queryByText("Echo Flask")).toBeNull();
    expect(screen.queryByText("Echo Ultimate")).toBeNull();
    expect(screen.queryByText(/Echo Refresh/)).toBeNull();
    // …and so is the internal "Products" nav link.
    expect(container.querySelector('a[href="/products"]')).toBeNull();
  });

  it("keeps the ownership disclosure, tagged with this page's type and slug", () => {
    const { container } = renderAt("/hydrogen-for/diabetes");
    expect(screen.getByText(/built and funded by Echo Technologies LLC/)).toBeInTheDocument();
    const links = echoLinks(container);
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      const url = new URL(a.getAttribute("href")!);
      expect(url.searchParams.get("utm_source")).toBe("hydrogenstudies");
      expect(url.searchParams.get("utm_medium")).toBe("referral");
      expect(url.searchParams.get("utm_campaign")).toBe("hydrogen-for");
      expect(url.searchParams.get("utm_content")).toBe("diabetes");
    }
  });

  it("uses home/home on the homepage", () => {
    const { container } = renderAt("/");
    const url = new URL(echoLinks(container)[0].getAttribute("href")!);
    expect(url.searchParams.get("utm_campaign")).toBe("home");
    expect(url.searchParams.get("utm_content")).toBe("home");
  });
});
