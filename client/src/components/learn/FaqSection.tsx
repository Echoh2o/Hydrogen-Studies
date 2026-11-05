import { FadeInOnScroll } from "@/components/animations/ScrollAnimations";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { LEARN_FAQS } from "./learn-faqs";

const faqItems = LEARN_FAQS;

export default function FaqSection() {
  return (
    <section
      style={{
        background: "var(--lp-bg)",
        padding: "var(--lp-section-pad)",
      }}
    >
      <div style={{ maxWidth: "var(--lp-max-width)", margin: "0 auto" }}>
        <FadeInOnScroll>
          <span className="lp-section-label">COMMON QUESTIONS</span>

          <h2
            style={{
              fontFamily: "var(--lp-font-display)",
              fontWeight: 600,
              fontSize: 44,
              color: "var(--lp-primary)",
              marginTop: 12,
              marginBottom: 40,
            }}
          >
            Questions people ask first
          </h2>
        </FadeInOnScroll>

        <FadeInOnScroll delay={0.1}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <Accordion type="single" collapsible>
              {faqItems.map((item, index) => (
                <AccordionItem key={index} value={`faq-${index}`}>
                  <AccordionTrigger
                    style={{
                      fontFamily: "var(--lp-font-body)",
                      fontSize: 16,
                      fontWeight: 500,
                      textAlign: "left",
                    }}
                  >
                    {item.question}
                  </AccordionTrigger>
                  {/* forceMount: answers stay in the server HTML while collapsed, so the
                      FAQPage block on /learn matches what's on the page. */}
                  <AccordionContent forceMount>
                    <div
                      style={{
                        background: "var(--lp-bg)",
                        borderLeft: "3px solid var(--lp-accent)",
                        paddingLeft: 20,
                        lineHeight: 1.8,
                        fontSize: 15,
                        fontFamily: "var(--lp-font-body)",
                        color: "var(--lp-text)",
                      }}
                    >
                      {item.answer}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </FadeInOnScroll>
      </div>
    </section>
  );
}
