import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { marked } from "marked";
import { headingId } from "@shared/heading-id";
import { buildBlogMarkdownComponents } from "../markdown-components";

describe("blog markdown components — heading anchors match the crawler", () => {
  it("h2/h3 ids equal the crawler's (marked + shared headingId), incl. inline markup and apostrophes", () => {
    const md = [
      "## Is hydrogen flammable?",
      "### Why 1–4% hydrogen mixtures can't burn",
      "## What **the evidence** doesn't show",
      "## [Linked](https://example.com) heading",
    ].join("\n\n");
    const crawlerIds = [...(marked.parse(md, { async: false }) as string).matchAll(/<h([23])>([\s\S]*?)<\/h\1>/g)]
      .map((m) => headingId(m[2].replace(/<[^>]*>/g, "")));
    const spa = renderToStaticMarkup(
      <ReactMarkdown components={buildBlogMarkdownComponents({ pageType: "blog", slug: "x" } as any)}>{md}</ReactMarkdown>,
    );
    const spaIds = [...spa.matchAll(/<h[23] id="([^"]+)"/g)].map((m) => m[1]);
    expect(spaIds).toEqual(crawlerIds);
    expect(spaIds).toEqual([
      "is-hydrogen-flammable",
      "why-1-4-hydrogen-mixtures-can-t-burn",
      "what-the-evidence-doesn-t-show",
      "linked-heading",
    ]);
  });

  it("body h1 is demoted to h2 without an id (matches the crawler, which demotes after assigning ids)", () => {
    const spa = renderToStaticMarkup(
      <ReactMarkdown components={buildBlogMarkdownComponents({ pageType: "blog", slug: "x" } as any)}>{"# Title"}</ReactMarkdown>,
    );
    expect(spa).toBe("<h2>Title</h2>");
  });
});
