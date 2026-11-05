import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import JsonLd from "@/components/seo/JsonLd";
import { ProductsGuideContent } from "./content/ProductsGuideContent";
import { PRODUCTS_FAQS } from "@shared/products-guide";

// Head + chrome for the SPA route; the body is shared with the Next page
// (web/app/products). FAQPage only because the FAQ is visible on the page.
const faqStructuredData = {
  mainEntity: PRODUCTS_FAQS.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  })),
};

export default function ProductsPage() {
  return (
    <>
      <Helmet>
        <title>Hydrogen Water Devices: What to Check | Hydrogen Studies</title>
        <meta
          name="description"
          content="How hydrogen water bottles, machines, tablets and inhalers work, what ppm figures mean, outgassing, electrodes and third-party testing, plus our funder Echo's devices, labeled."
        />
        <link rel="canonical" href="https://hydrogenstudies.com/products" />
      </Helmet>
      <JsonLd type="FAQPage" data={faqStructuredData} />
      <SiteHeader />
      <ProductsGuideContent />
      <Footer />
    </>
  );
}
