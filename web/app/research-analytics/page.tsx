import { ResearchAnalyticsContent } from "@/pages/content/ResearchAnalyticsContent";
import { contentPage } from "@web/lib/content-page";
import { prefetchQueries } from "@web/lib/prefetch";
import { ClientProviders } from "@web/components/ClientProviders";

// Same body as the SPA page, with the five analytics responses it charts
// fetched on the server so the numbers are in the HTML.
const page = contentPage("/research-analytics");

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;

const QUERIES = [
  "/api/studies/analytics",
  "/api/studies/citation-network",
  "/api/studies/timeline",
  "/api/studies/trends",
  "/api/studies/health-outcomes",
];

export default async function Page() {
  const state = await prefetchQueries(QUERIES, 600, ["/research-analytics"]);
  return (
    <page.Shell>
      <ClientProviders dehydratedState={state}>
        <ResearchAnalyticsContent />
      </ClientProviders>
    </page.Shell>
  );
}
