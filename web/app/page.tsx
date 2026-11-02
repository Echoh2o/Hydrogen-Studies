import { HomeContent, type SiteStats } from "@/pages/content/HomeContent";
import { contentPage } from "@web/lib/content-page";
import { expressJson } from "@web/lib/page-data";

// Same body component as the SPA homepage, with its numbers fetched on the
// server so they're in the HTML (the SPA showed "..." until JS loaded).
const page = contentPage("/");

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;

async function safe<T>(path: string): Promise<T | undefined> {
  try {
    return await expressJson<T>(path, 600);
  } catch {
    return undefined; // HomeContent has fallbacks for missing stats
  }
}

export default async function Page() {
  const [siteStats, categoryStats] = await Promise.all([
    safe<SiteStats>("/api/public-stats"),
    safe<Record<string, unknown>>("/api/consumer-categories/counts"),
  ]);
  return (
    <page.Shell className="min-h-screen bg-white">
      <HomeContent siteStats={siteStats} categoryStats={categoryStats} />
    </page.Shell>
  );
}
