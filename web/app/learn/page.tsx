import { LearnContent } from "@/pages/content/LearnContent";
import { LEARN_FAQS } from "@shared/learn-faqs";
import { faqPageJsonLd } from "@shared/seo-markup";
import { contentPage } from "@web/lib/content-page";
import { prefetchQueries } from "@web/lib/prefetch";
import { ClientProviders } from "@web/components/ClientProviders";

// Same twelve sections as the SPA page, with the stats they show fetched on
// the server. FAQPage is allowed: FaqSection renders LEARN_FAQS on the page.
const page = contentPage("/learn", [faqPageJsonLd(LEARN_FAQS)]);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;

export default async function Page() {
  const state = await prefetchQueries(["/api/learn-stats"], 600, ["/learn"]);
  return (
    <page.Shell className="learn-page">
      <ClientProviders dehydratedState={state}>
        <LearnContent />
      </ClientProviders>
    </page.Shell>
  );
}
