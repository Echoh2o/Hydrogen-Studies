import { HomeContent, type SiteStats } from "@/pages/content/HomeContent";
import { contentPage } from "@web/lib/content-page";
import { expressJson, pageData } from "@web/lib/page-data";
import { LatestResearch, type HomeLinks } from "@web/components/LatestResearch";

// Same body component as the SPA homepage, with its numbers fetched on the
// server so they're in the HTML (the SPA showed "..." until JS loaded).
const page = contentPage("/");

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;

async function safe<T>(load: () => Promise<T>): Promise<T | undefined> {
  try {
    return await load();
  } catch {
    return undefined; // the sections have fallbacks / render nothing
  }
}

export default async function Page() {
  const [siteStats, categoryStats, links] = await Promise.all([
    safe(() => expressJson<SiteStats>("/api/public-stats", 600, ["/"])),
    safe(() => expressJson<Record<string, unknown>>("/api/consumer-categories/counts", 600, ["/"])),
    safe(() => pageData<HomeLinks>("/home", 600, ["/"])),
  ]);
  return (
    <page.Shell className="min-h-screen bg-white">
      <HomeContent siteStats={siteStats} categoryStats={categoryStats} />
      {links && <LatestResearch links={links} />}
    </page.Shell>
  );
}
