import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { PageDataError, pageData, type FooterCondition } from "@web/lib/page-data";
import { SiteHeader } from "@web/components/SiteHeader";
import { SiteFooter } from "@web/components/SiteFooter";

/**
 * Pages whose body is a shared React component (client/src/pages/content/*):
 * Express supplies the meta crawlers already get (GET /api/page-data/meta);
 * the body is the same component the SPA renders.
 */
interface MetaData {
  meta: {
    title: string;
    description: string;
    canonical: string;
    ogType: string;
    ogImage: string;
    jsonLd?: object | object[];
    robots?: string;
  };
  footerConditions: FooterCondition[];
}

async function load(path: string): Promise<MetaData> {
  try {
    return await pageData<MetaData>(`/meta?path=${encodeURIComponent(path)}`, 3600);
  } catch (err) {
    if (err instanceof PageDataError && err.status === 404) notFound();
    throw err;
  }
}

export function contentPage(path: string, extraJsonLd: object[] = []) {
  async function generateMetadata(): Promise<Metadata> {
    const { meta } = await load(path);
    const v = (meta.robots ?? "index, follow").toLowerCase();
    return {
      title: { absolute: meta.title },
      description: meta.description,
      alternates: { canonical: meta.canonical },
      robots: { index: !v.includes("noindex"), follow: !v.includes("nofollow") },
      openGraph: { type: "website", title: meta.title, description: meta.description, url: meta.canonical, siteName: "Hydrogen Studies", locale: "en_US", images: [meta.ogImage] },
      twitter: { card: "summary_large_image", title: meta.title, description: meta.description, images: [meta.ogImage] },
    };
  }

  async function Shell({ children, className }: { children: ReactNode; className?: string }) {
    const { meta, footerConditions } = await load(path);
    const ld = [...(meta.jsonLd ? (Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd]) : []), ...extraJsonLd];
    return (
      <div className={className}>
        {ld.map((block, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }} />
        ))}
        <SiteHeader />
        <div id="main">{children}</div>
        <SiteFooter conditions={footerConditions} pageType={path.slice(1) || "home"} slug={path.slice(1) || "home"} />
      </div>
    );
  }

  return { generateMetadata, Shell };
}
