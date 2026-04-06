import { FadeInOnScroll } from "@/components/animations/ScrollAnimations";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const faqItems = [
  {
    question: "Is hydrogen water safe?",
    answer:
      "Yes. Hydrogen gas is produced naturally in your gut every day \u2014 your body is already familiar with it. Numerous human clinical trials have reported no adverse effects. Because H\u2082 selectively targets only the most harmful free radicals, it does not disrupt the normal cellular processes that some antioxidants can interfere with.",
  },
  {
    question: "Does hydrogen water taste different from regular water?",
    answer:
      "No noticeable difference for most people. Molecular hydrogen is colorless, odorless, and tasteless. The vast majority of participants in clinical trials could not tell hydrogen water apart from plain water in blind tests.",
  },
  {
    question: "How much hydrogen water should I drink?",
    answer:
      'Most clinical studies have used between 500ml and 1.5 liters per day. There is no established "optimal dose" yet \u2014 the research is still developing. What the studies suggest is that consistency over time matters more than any single large serving.',
  },
  {
    question: "How long does it take to notice anything?",
    answer:
      "It varies significantly by individual and by what outcome you are looking for. Some athletic recovery studies saw measurable changes in blood markers within 7\u201314 days. Outcomes related to inflammation and oxidative stress markers typically appeared after 4\u20138 weeks of consistent daily use.",
  },
  {
    question: "Does hydrogen stay in the water once it is made?",
    answer:
      "No \u2014 dissolved H\u2082 gas escapes from water relatively quickly, especially when exposed to air. For the best concentration, hydrogen water should be consumed soon after it is produced. This is one reason why on-demand machines consistently outperform pre-bottled hydrogen water or water prepared hours in advance.",
  },
  {
    question:
      'Is this the same as "smart water," "structured water," or "alkaline water"?',
    answer:
      'No. These are entirely different concepts with different (and far less robust) research bases. Molecular hydrogen water has a specific, measurable compound \u2014 dissolved H\u2082 gas \u2014 with a growing body of peer-reviewed evidence. "Structured water" in particular has no established scientific basis.',
  },
  {
    question: "Is the research on this site peer-reviewed?",
    answer:
      "Yes. Every study in the hydrogenstudies.com database comes from peer-reviewed academic journals. We do not include company-funded white papers, opinion pieces, press releases, or editorial content. The database exists specifically to give the public direct access to the actual science.",
  },
  {
    question:
      "Is this the same as drinking water with extra hydrogen peroxide?",
    answer:
      "No \u2014 and this is an important distinction. Hydrogen peroxide is H\u2082O\u2082 \u2014 a reactive oxygen compound. Molecular hydrogen is H\u2082 \u2014 a gas. They are chemically and biologically opposite. H\u2082O\u2082 is an oxidizing agent that damages cells. H\u2082 is an antioxidant that protects them.",
  },
];

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
