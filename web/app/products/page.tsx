import { ProductsGuideContent } from "@/pages/content/ProductsGuideContent";
import { contentPage } from "@web/lib/content-page";
import { WouterBridge } from "@web/components/WouterBridge";
import { faqPageJsonLd } from "@shared/seo-markup";
import { PRODUCTS_FAQS, PRODUCTS_PATH } from "@shared/products-guide";

// PLAN 5.4 device guide. Same body as the SPA route; FAQPage because the FAQ
// is visible on the page.
const page = contentPage(PRODUCTS_PATH, [faqPageJsonLd(PRODUCTS_FAQS)]);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;

export default async function Page() {
  return (
    <page.Shell>
      <WouterBridge path={PRODUCTS_PATH} search="">
        <ProductsGuideContent />
      </WouterBridge>
    </page.Shell>
  );
}
