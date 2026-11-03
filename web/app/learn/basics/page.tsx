import { HydrogenBasicsContent } from "@/pages/content/HydrogenBasicsContent";
import { contentPage } from "@web/lib/content-page";
import { prefetchQueries } from "@web/lib/prefetch";
import { ClientProviders } from "@web/components/ClientProviders";
import { WouterBridge } from "@web/components/WouterBridge";

// Same body as the SPA page; the study count it shows is fetched on the server.
const page = contentPage("/learn/basics");

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;

export default async function Page() {
  const state = await prefetchQueries(["/api/public-stats"], 600, ["/learn/basics"]);
  return (
    <page.Shell>
      <ClientProviders dehydratedState={state}>
        <WouterBridge path="/learn/basics" search="">
          <HydrogenBasicsContent />
        </WouterBridge>
      </ClientProviders>
    </page.Shell>
  );
}
