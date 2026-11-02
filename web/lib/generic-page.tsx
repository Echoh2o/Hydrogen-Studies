import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageDataError, pageData, type FooterCondition } from "@web/lib/page-data";
import { SiteHeader } from "@web/components/SiteHeader";
import { SiteFooter } from "@web/components/SiteFooter";

/**
 * Pages the crawler renderer already builds (blog, hubs, /hydrogen-for,
 * policy pages): Express returns the meta, JSON-LD and body HTML it has been
 * serving crawlers (GET /api/page-data/page); Next serves it to everyone.
 */
interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogType: string;
  ogImage: string;
  jsonLd?: object | object[];
  robots?: string;
}

interface GenericPageData {
  meta: PageMeta;
  bodyHtml: string;
  footerConditions: FooterCondition[];
}

async function load(path: string, revalidate: number): Promise<GenericPageData> {
  try {
    return await pageData<GenericPageData>(`/page?path=${encodeURIComponent(path)}`, revalidate);
  } catch (err) {
    if (err instanceof PageDataError && (err.status === 404 || err.status === 410)) notFound();
    throw err;
  }
}

function robotsFrom(value: string | undefined): Metadata["robots"] {
  const v = (value ?? "index, follow").toLowerCase();
  return { index: !v.includes("noindex"), follow: !v.includes("nofollow") };
}

/** The page_type UTM value for links on this path (CLAUDE.md UTM rule). */
function pageTypeFor(path: string): string {
  if (path.startsWith("/blog")) return "blog";
  if (path.startsWith("/hydrogen-for/")) return "hydrogen-for";
  if (path.startsWith("/explore-by-")) return "hub";
  return path.replace(/^\//, "") || "home";
}

export function genericPage<P>(pathFor: (params: P) => string, revalidate: number) {
  async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
    const { meta } = await load(pathFor(params), revalidate);
    const og = meta.ogType === "article" ? "article" : "website";
    return {
      title: { absolute: meta.title },
      description: meta.description,
      alternates: { canonical: meta.canonical },
      robots: robotsFrom(meta.robots),
      openGraph: {
        type: og,
        title: meta.title,
        description: meta.description,
        url: meta.canonical,
        siteName: "Hydrogen Studies",
        locale: "en_US",
        images: [meta.ogImage],
      },
      twitter: { card: "summary_large_image", title: meta.title, description: meta.description, images: [meta.ogImage] },
    };
  }

  async function Page({ params }: { params: P }) {
    const path = pathFor(params);
    const { meta, bodyHtml, footerConditions } = await load(path, revalidate);
    const ld = meta.jsonLd ? (Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd]) : [];
    const slug = path.split("/").filter(Boolean).pop() ?? "home";
    return (
      <>
        {ld.map((block, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }} />
        ))}
        <SiteHeader />
        <main id="main" className="container mx-auto max-w-4xl px-4 py-8">
          {/* Server-rendered, sanitized by the Express renderer (same HTML crawlers indexed). */}
          <div className="page-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </main>
        <SiteFooter conditions={footerConditions} pageType={pageTypeFor(path)} slug={slug} />
      </>
    );
  }

  return { generateMetadata, Page };
}
