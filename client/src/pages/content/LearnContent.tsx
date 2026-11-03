"use client";
// Body of /learn — the twelve sections — shared by the SPA page (LearnPage)
// and the Next.js front door. Needs React Query (/api/learn-stats).
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

export function LearnContent() {
  return (
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
  );
}
