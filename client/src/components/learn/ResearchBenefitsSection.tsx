import { FadeInOnScroll } from "@/components/animations/ScrollAnimations";

const benefitCards = [
  {
    title: "Energy & Fatigue",
    summary:
      "H\u2082 may help cells produce energy more efficiently and reduce feelings of tiredness, including in healthy adults and cancer patients undergoing treatment.",
    count: "41 studies \u2192",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path
          d="M18 4L8 18H16L14 28L24 14H16L18 4Z"
          stroke="var(--lp-accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    title: "Brain & Mood",
    summary:
      "Research suggests H\u2082 may protect brain cells from damage, support mental clarity, and reduce markers associated with neurodegenerative conditions.",
    count: "67 studies \u2192",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path
          d="M16 6C11 6 7 10 7 15C7 18 8.5 20.5 11 22V26H21V22C23.5 20.5 25 18 25 15C25 10 21 6 16 6Z"
          stroke="var(--lp-accent)"
          strokeWidth="2"
          fill="none"
          strokeLinejoin="round"
        />
        <path
          d="M12 16C12 16 14 18 16 14C18 10 20 16 20 16"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    title: "Heart Health",
    summary:
      "Several human trials show H\u2082 may support healthy blood pressure, improve artery function, and reduce oxidative markers linked to cardiovascular disease.",
    count: "89 studies \u2192",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path
          d="M16 27L6 17C3 14 3 9 6.5 6.5C10 4 13 5 16 9C19 5 22 4 25.5 6.5C29 9 29 14 26 17L16 27Z"
          stroke="var(--lp-accent)"
          strokeWidth="2"
          fill="none"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Inflammation",
    summary:
      "H\u2082 has shown consistent anti-inflammatory effects in both animal models and human trials, including for conditions driven by chronic systemic inflammation.",
    count: "122 studies \u2192",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path
          d="M16 4C16 4 10 12 10 18C10 22 12 26 16 28C20 26 22 22 22 18C22 12 16 4 16 4Z"
          stroke="var(--lp-accent)"
          strokeWidth="2"
          fill="none"
          strokeLinejoin="round"
        />
        <path
          d="M16 12C16 12 13 16 13 19C13 21 14.5 23 16 24C17.5 23 19 21 19 19C19 16 16 12 16 12Z"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          fill="none"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Metabolism",
    summary:
      "Studies link H\u2082 to improved blood sugar regulation, reduced triglycerides, and lower risk markers associated with metabolic syndrome and type 2 diabetes.",
    count: "58 studies \u2192",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <line
          x1="16"
          y1="4"
          x2="16"
          y2="28"
          stroke="var(--lp-accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="6"
          y1="16"
          x2="26"
          y2="16"
          stroke="var(--lp-accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle
          cx="10"
          cy="10"
          r="3"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          fill="none"
        />
        <circle
          cx="22"
          cy="22"
          r="3"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    ),
  },
  {
    title: "Athletic Recovery",
    summary:
      "Athletes using H\u2082 water show faster recovery, lower blood lactic acid levels, and reduced muscle fatigue following high-intensity exercise.",
    count: "33 studies \u2192",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle
          cx="16"
          cy="6"
          r="3"
          stroke="var(--lp-accent)"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M12 14L16 10L20 14L18 20L22 28M14 20L10 28"
          stroke="var(--lp-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M8 16L12 14M20 14L24 12"
          stroke="var(--lp-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    title: "Gut Health",
    summary:
      "H\u2082 is naturally produced in the gut by bacteria fermenting fiber. Research is exploring its role in microbiome balance and gastrointestinal health.",
    count: "29 studies \u2192",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path
          d="M12 6C12 6 8 10 8 14C8 18 12 18 12 22C12 26 16 28 16 28"
          stroke="var(--lp-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M20 6C20 6 24 10 24 14C24 18 20 18 20 22C20 26 16 28 16 28"
          stroke="var(--lp-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    title: "Aging & Oxidative Stress",
    summary:
      "H\u2082 reduces measurable oxidative stress markers \u2014 biological signals linked to cellular aging \u2014 across multiple human and animal trials.",
    count: "94 studies \u2192",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path
          d="M16 4L20 4L20 12L24 12L16 20L8 12L12 12L12 4L16 4Z"
          stroke="var(--lp-accent)"
          strokeWidth="2"
          fill="none"
          strokeLinejoin="round"
        />
        <path
          d="M12 28L20 28"
          stroke="var(--lp-accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M10 24L22 24"
          stroke="var(--lp-accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export default function ResearchBenefitsSection() {
  return (
    <section
      style={{
        background: "var(--lp-bg)",
        padding: "var(--lp-section-pad)",
      }}
    >
      <div style={{ maxWidth: "var(--lp-max-width)", margin: "0 auto" }}>
        <FadeInOnScroll>
          <span className="lp-section-label">PEER-REVIEWED EVIDENCE</span>

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
            What scientists have found so far
          </h2>

          <p
            style={{
              fontSize: 18,
              color: "var(--lp-muted)",
              fontFamily: "var(--lp-font-body)",
              maxWidth: 600,
              marginBottom: 8,
            }}
          >
            These are plain-language summaries of published research. Each card
            links to the studies in our database.
          </p>

          <p
            style={{
              fontSize: 13,
              color: "var(--lp-muted)",
              fontFamily: "var(--lp-font-body)",
              fontStyle: "italic",
              marginBottom: 40,
            }}
          >
            Research summaries only. Molecular hydrogen is not approved to treat,
            cure, or prevent any disease.
          </p>
        </FadeInOnScroll>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {benefitCards.map((card, index) => (
            <FadeInOnScroll key={index} delay={index * 0.05}>
              <div className="benefit-card" style={cardStyle}>
                <div style={{ marginBottom: 12 }}>{card.icon}</div>

                <h3
                  style={{
                    fontFamily: "var(--lp-font-display)",
                    fontWeight: 600,
                    fontSize: 18,
                    color: "var(--lp-primary)",
                    marginBottom: 8,
                  }}
                >
                  {card.title}
                </h3>

                <p
                  style={{
                    fontSize: 15,
                    color: "var(--lp-muted)",
                    fontFamily: "var(--lp-font-body)",
                    lineHeight: 1.6,
                    marginBottom: 16,
                    flex: 1,
                  }}
                >
                  {card.summary}
                </p>

                <a
                  href="/studies"
                  style={{
                    background: "var(--lp-accent-lt)",
                    color: "var(--lp-accent)",
                    fontSize: 12,
                    fontFamily: "var(--lp-font-body)",
                    fontWeight: 600,
                    borderRadius: 999,
                    padding: "5px 14px",
                    textDecoration: "none",
                    display: "inline-block",
                  }}
                >
                  {card.count}
                </a>
              </div>
            </FadeInOnScroll>
          ))}
        </div>

        <style>{`
          .benefit-card {
            transition: border-top-color 0.2s, transform 0.2s;
          }
          .benefit-card:hover {
            border-top-color: var(--lp-accent) !important;
            transform: translateY(-3px);
          }
        `}</style>
      </div>
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "var(--lp-radius-md)",
  boxShadow: "var(--lp-shadow-card)",
  padding: 24,
  borderTop: "3px solid transparent",
  display: "flex",
  flexDirection: "column",
  height: "100%",
};
