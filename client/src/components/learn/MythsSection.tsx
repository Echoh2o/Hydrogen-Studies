import { FadeInOnScroll } from "@/components/animations/ScrollAnimations";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const mythItems = [
  {
    question: "Isn\u2019t this just alkaline water?",
    answer:
      "Not at all. Alkaline water changes the pH of water \u2014 making it less acidic. Hydrogen water adds dissolved H\u2082 gas to water. They are completely different chemistry with different mechanisms and different research bases. Most alkaline water contains little to no dissolved H\u2082. Comparing them is like confusing carbonated water with regular water just because both come in bottles.",
  },
  {
    question: "Isn\u2019t hydrogen gas explosive?",
    answer:
      "Hydrogen is flammable at concentrations above 4% in air. The amount dissolved in hydrogen water is approximately 0.0016% \u2014 thousands of times below any threshold of concern. For comparison, your gut produces far more hydrogen gas naturally every single day than you would ever consume in hydrogen water. You have been safely producing H\u2082 internally your whole life.",
  },
  {
    question: "Didn\u2019t I read this is just a wellness trend?",
    answer:
      "The first major study was published in Nature Medicine in 2007 by researchers at Nippon Medical School. Since then, over 1,335 peer-reviewed studies have been published in respected academic journals worldwide. The research is early-stage \u2014 but it is serious science, not social media wellness content. This database exists to give you direct access to those studies.",
  },
  {
    question: "Is this the same as oxygenated water?",
    answer:
      "No. Oxygenated water adds oxygen (O\u2082) to water. Hydrogen water adds hydrogen (H\u2082). They are completely different gases with completely different effects in the body. The published research on oxygenated water is minimal. The research on hydrogen water now exceeds 1,335 peer-reviewed studies.",
  },
  {
    question: "Don\u2019t I already get hydrogen from regular water?",
    answer:
      "Water (H\u2082O) contains hydrogen, but it is chemically bonded to oxygen \u2014 your body cannot access it as free H\u2082. The only naturally occurring free H\u2082 in your body comes from gut bacteria breaking down dietary fiber. Hydrogen-enriched water adds dissolved H\u2082 gas directly, in a form your body can absorb immediately upon drinking.",
  },
];

export default function MythsSection() {
  return (
    <section
      style={{
        background: "var(--lp-surface)",
        padding: "var(--lp-section-pad)",
      }}
    >
      <div style={{ maxWidth: "var(--lp-max-width)", margin: "0 auto" }}>
        <FadeInOnScroll>
          <span className="lp-section-label">CLEARING THE AIR</span>

          <h2
            style={{
              fontFamily: "var(--lp-font-display)",
              fontWeight: 600,
              fontSize: 44,
              color: "var(--lp-primary)",
              marginTop: 12,
              marginBottom: 8,
            }}
          >
            Let&rsquo;s clear a few things up
          </h2>

          <p
            style={{
              fontSize: 18,
              color: "var(--lp-muted)",
              fontFamily: "var(--lp-font-body)",
              marginBottom: 40,
            }}
          >
            These are the questions skeptics ask first. They are good questions.
          </p>
        </FadeInOnScroll>

        <FadeInOnScroll delay={0.1}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <Accordion type="single" collapsible>
              {mythItems.map((item, index) => (
                <AccordionItem key={index} value={`myth-${index}`}>
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
                  <AccordionContent>
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
