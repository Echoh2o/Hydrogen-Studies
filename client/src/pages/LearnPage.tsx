import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import JsonLd from "@/components/seo/JsonLd";
import { LearnContent } from "./content/LearnContent";
import { LEARN_FAQS } from "@shared/learn-faqs";

const faqStructuredData = {
  mainEntity: LEARN_FAQS.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  })),
};

export default function LearnPage() {
  return (
    <div className="learn-page">
      <Helmet>
        <title>Learn About Molecular Hydrogen | Hydrogen Studies</title>
        <meta
          name="description"
          content="Everything you need to understand molecular hydrogen (H₂) — what it is, how it works, and what 2,000+ studies have (and haven't) found. Plain English. No hype."
        />
        <meta property="og:title" content="Learn About Molecular Hydrogen" />
        <meta
          property="og:description"
          content="What molecular hydrogen is, how it works, and what the research shows. Plain English."
        />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://hydrogenstudies.com/learn" />
        <link rel="canonical" href="https://hydrogenstudies.com/learn" />
      </Helmet>

      <JsonLd type="FAQPage" data={faqStructuredData} />

      <SiteHeader />

      <LearnContent />

      <Footer />
    </div>
  );
}
