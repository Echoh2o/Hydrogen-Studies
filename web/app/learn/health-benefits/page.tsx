import { HealthBenefitsContent } from "@/pages/content/HealthBenefitsContent";
import { contentPage } from "@web/lib/content-page";
import { prefetchQueries } from "@web/lib/prefetch";
import { ClientProviders } from "@web/components/ClientProviders";
import { WouterBridge } from "@web/components/WouterBridge";

// Same body as the SPA page; the per-area study counts are fetched on the server.
const page = contentPage("/learn/health-benefits");

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;

export default async function Page() {
  const state = await prefetchQueries(["/api/consumer-categories/counts"], 600, ["/learn/health-benefits"]);
  return (
    <page.Shell>
      <ClientProviders dehydratedState={state}>
        <WouterBridge path="/learn/health-benefits" search="">
          <HealthBenefitsContent />
        </WouterBridge>
      </ClientProviders>
    </page.Shell>
  );
}
