import { HydrogenTherapyGuideContent } from "@/pages/content/HydrogenTherapyGuideContent";
import { THERAPY_GUIDE_FAQS } from "@shared/learn-faqs";
import { faqPageJsonLd } from "@shared/seo-markup";
import { contentPage } from "@web/lib/content-page";
import { WouterBridge } from "@web/components/WouterBridge";

// Same body as the SPA page. FAQPage is allowed: the guide renders
// THERAPY_GUIDE_FAQS in its FAQ section.
const page = contentPage("/learn/therapy-guide", [faqPageJsonLd(THERAPY_GUIDE_FAQS)]);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;

export default function Page() {
  return (
    <page.Shell>
      <WouterBridge path="/learn/therapy-guide" search="">
        <HydrogenTherapyGuideContent />
      </WouterBridge>
    </page.Shell>
  );
}
