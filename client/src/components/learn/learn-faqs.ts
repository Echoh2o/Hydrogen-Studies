// /learn FAQ — one source for the visible accordion (FaqSection) and the
// FAQPage JSON-LD (LearnPage), so schema always matches what's on the page.
// Accuracy-reviewed 2026-11-02 (claims checked against the hub evidence pages).
export const LEARN_FAQS: { question: string; answer: string }[] = [
  {
    question: "Is hydrogen water safe?",
    answer:
      "In the human trials so far it has been well tolerated: most found no serious side effects, and those reported were mild, such as loose stools or bloating, mostly with magnesium-based tablets. Your gut bacteria also make hydrogen every day. But the trials are small and short — safety beyond a few months hasn't been studied. If you're pregnant, take medication or have a medical condition, talk to your doctor first.",
  },
  {
    question: "Does hydrogen water taste different from regular water?",
    answer:
      "Hydrogen has no color, smell or taste, so hydrogen water tastes like the water it was made from. Magnesium-based tablets can leave a slight mineral taste.",
  },
  {
    question: "How much hydrogen water should I drink?",
    answer:
      'Human drinking trials have mostly used about 0.5 to 1.5 liters a day, for days to a few months. No trial has compared different amounts, so there is no established "right" dose.',
  },
  {
    question: "How long does it take to notice anything?",
    answer:
      "There's no reliable timeline. Some exercise trials measured changes in blood lactate or perceived fatigue after a single session; trials of blood markers usually ran 4 to 24 weeks — and many found little or no difference from placebo. Results in trials don't predict what any one person will notice.",
  },
  {
    question: "Does hydrogen stay in the water once it is made?",
    answer:
      "No — dissolved hydrogen escapes from water fairly quickly, especially in an open glass. The concentration when you drink matters more than the number on a label, so water made right before drinking keeps more hydrogen than water made hours in advance.",
  },
  {
    question: 'Is this the same as "smart water," "structured water," or "alkaline water"?',
    answer:
      'No. Hydrogen water contains a specific, measurable ingredient — dissolved hydrogen gas — with a growing but still mostly small body of research. Alkaline water changes pH, which is different chemistry. "Structured water" has no established scientific basis.',
  },
  {
    question: "Is the research on this site peer-reviewed?",
    answer:
      "Mostly. The large majority of studies in our database come from peer-reviewed journals, but it also includes some conference abstracts and preprints, and many studies were funded by companies that sell hydrogen products. Each study page shows its source and, where reported, its funding and conflicts of interest.",
  },
  {
    question: "Is this the same as drinking water with extra hydrogen peroxide?",
    answer:
      "No. Hydrogen peroxide (H\u2082O\u2082) is a reactive oxidizing compound that can damage cells. Molecular hydrogen (H\u2082) is a gas that acts as a mild antioxidant in lab and animal studies. They are chemically very different.",
  },
];
