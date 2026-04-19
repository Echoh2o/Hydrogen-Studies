import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import JsonLd from "@/components/seo/JsonLd";
import LearnHero from "@/components/learn/LearnHero";
import WhatIsH2Section from "@/components/learn/WhatIsH2Section";
import OxidativeStressSection from "@/components/learn/OxidativeStressSection";
import WhyH2DifferentSection from "@/components/learn/WhyH2DifferentSection";
import BodyMapSection from "@/components/learn/BodyMapSection";
import MythsSection from "@/components/learn/MythsSection";
import QuizSection from "@/components/learn/QuizSection";
import ResearchBenefitsSection from "@/components/learn/ResearchBenefitsSection";
import EvidenceSection from "@/components/learn/EvidenceSection";
import DeliveryMethodsSection from "@/components/learn/DeliveryMethodsSection";
import FaqSection from "@/components/learn/FaqSection";
import TldrSection from "@/components/learn/TldrSection";
import DualCtaSection from "@/components/learn/DualCtaSection";

const faqStructuredData = {
  mainEntity: [
    {
      "@type": "Question",
      name: "Is hydrogen water safe?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Hydrogen gas is produced naturally in your gut every day. Numerous human clinical trials have reported no adverse effects.",
      },
    },
    {
      "@type": "Question",
      name: "Does hydrogen water taste different from regular water?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No noticeable difference for most people. Molecular hydrogen is colorless, odorless, and tasteless.",
      },
    },
    {
      "@type": "Question",
      name: "How much hydrogen water should I drink?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most clinical studies have used between 500ml and 1.5 liters per day. Consistency over time matters more than any single large serving.",
      },
    },
    {
      "@type": "Question",
      name: "How long does it take to notice anything?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It varies by individual. Some athletic recovery studies saw changes in 7–14 days. Inflammation markers typically appeared after 4–8 weeks.",
      },
    },
    {
      "@type": "Question",
      name: "Does hydrogen stay in the water once it is made?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No — dissolved H₂ gas escapes relatively quickly. Hydrogen water should be consumed soon after it is produced.",
      },
    },
    {
      "@type": "Question",
      name: "Is this the same as alkaline water?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Alkaline water changes pH. Hydrogen water adds dissolved H₂ gas. They are completely different chemistry.",
      },
    },
    {
      "@type": "Question",
      name: "Is the research on this site peer-reviewed?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Every study in the database comes from peer-reviewed academic journals.",
      },
    },
    {
      "@type": "Question",
      name: "Is this the same as hydrogen peroxide?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Hydrogen peroxide (H₂O₂) is an oxidizing agent. Molecular hydrogen (H₂) is an antioxidant. They are chemically opposite.",
      },
    },
  ],
};

export default function LearnPage() {
  return (
    <div className="learn-page">
      <Helmet>
        <title>Learn About Molecular Hydrogen | Hydrogen Studies</title>
        <meta
          name="description"
          content="Everything you need to understand molecular hydrogen (H₂) — what it is, how it works, and what 1,335+ peer-reviewed studies have found. Plain English. No hype."
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

      <main>
        <LearnHero />
        <WhatIsH2Section />
        <OxidativeStressSection />
        <WhyH2DifferentSection />
        <BodyMapSection />
        <MythsSection />
        <QuizSection />
        <ResearchBenefitsSection />
        <EvidenceSection />
        <DeliveryMethodsSection />
        <FaqSection />
        <TldrSection />
        <DualCtaSection />
      </main>

      <Footer />
    </div>
  );
}
