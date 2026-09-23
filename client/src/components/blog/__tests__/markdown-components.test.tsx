/**
 * Blog body markdown overrides (SPA twin of the bot renderer's
 * demoteH1InHtml + rewriteEchoLinksInHtml):
 *  - body "# Heading" renders as <h2> (the page owns the only <h1>)
 *  - echowater.com links carry the canonical UTM set for THIS page
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Markdown from "react-markdown";
import { buildBlogMarkdownComponents } from "../markdown-components";

const ctx = { pageType: "blog", slug: "hydrogen-water-ppm-levels" };

function renderMd(md: string) {
  return render(<Markdown components={buildBlogMarkdownComponents(ctx)}>{md}</Markdown>);
}

describe("buildBlogMarkdownComponents", () => {
  it("demotes body H1 to H2", () => {
    const { container } = renderMd("# Duplicate Title\n\nBody text.\n\n## Section");
    expect(container.querySelector("h1")).toBeNull();
    const h2s = Array.from(container.querySelectorAll("h2")).map((h) => h.textContent);
    expect(h2s).toEqual(["Duplicate Title", "Section"]);
  });

  it("tags echowater.com links with page-level UTMs, replacing stale ones", () => {
    const { container } = renderMd(
      "[Echo Flask](https://echowater.com/products/echo-flask?utm_campaign=footer&utm_content=disclosure&variant=1)",
    );
    const a = container.querySelector("a")!;
    const url = new URL(a.getAttribute("href")!);
    expect(url.hostname).toBe("echowater.com");
    expect(url.pathname).toBe("/products/echo-flask");
    expect(url.searchParams.get("utm_source")).toBe("hydrogenstudies");
    expect(url.searchParams.get("utm_medium")).toBe("referral");
    expect(url.searchParams.get("utm_campaign")).toBe("blog");
    expect(url.searchParams.get("utm_content")).toBe("hydrogen-water-ppm-levels");
    expect(url.searchParams.get("variant")).toBe("1");
    expect(a.getAttribute("rel")).toContain("sponsored");
  });

  it("tags untagged www.echowater.com links too", () => {
    const { container } = renderMd("See [the store](https://www.echowater.com/).");
    const url = new URL(container.querySelector("a")!.getAttribute("href")!);
    expect(url.searchParams.get("utm_campaign")).toBe("blog");
  });

  it("leaves non-echowater links untouched", () => {
    const { container } = renderMd(
      "[PubMed](https://pubmed.ncbi.nlm.nih.gov/123456/) and [a post](/blog/other-post)",
    );
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["https://pubmed.ncbi.nlm.nih.gov/123456/", "/blog/other-post"]);
    for (const a of Array.from(container.querySelectorAll("a"))) {
      expect(a.getAttribute("rel")).toBeNull();
    }
  });
});
