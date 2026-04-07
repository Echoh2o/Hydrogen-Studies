import { FadeInOnScroll } from "@/components/animations/ScrollAnimations";

const deliveryMethods = [
  {
    name: "Hydrogen Water Machines",
    badge: "Most studied delivery method",
    howItWorks:
      "An electrolysis chamber infuses water with H\u2082 gas as it flows through. No electrodes contact the drinking water directly.",
    concentration: "1.0 \u2013 1.5 ppm",
    bestFor: "Daily home use, consistent high-dose intake.",
    note: "The delivery method used in the majority of human clinical trials. Provides consistent daily intake at therapeutic concentrations.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect
          x="5"
          y="3"
          width="14"
          height="18"
          rx="2"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M9 10L12 7L15 10"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <line
          x1="12"
          y1="7"
          x2="12"
          y2="17"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    name: "Hydrogen Water Bottles",
    badge: "Portable high concentration",
    howItWorks:
      "Portable electrolysis devices that generate H\u2082 directly in a sealed bottle. SPE/PEM technology separates hydrogen from oxygen for higher purity.",
    concentration: "3.0 \u2013 8.0 ppm",
    bestFor: "On-the-go use, travel, personal high-concentration intake.",
    note: "Higher concentrations than countertop machines due to pressurized sealed design. The Echo Go+ achieves up to 4.5 ppm.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 2H15V5C15 5 17 6 17 8V19C17 20.1 16.1 21 15 21H9C7.9 21 7 20.1 7 19V8C7 6 9 5 9 5V2Z"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
        <line
          x1="7"
          y1="13"
          x2="17"
          y2="13"
          stroke="var(--lp-accent)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        <path
          d="M10 3H14"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    name: "Powdered Drink Mixes",
    badge: "Highest concentration available",
    howItWorks:
      "Magnesium-based hydrogen-generating powder dissolved in water. The chemical reaction produces extremely high dissolved H\u2082 levels in a sealed container.",
    concentration: "10.0 \u2013 16.0+ ppm",
    bestFor:
      "Maximum therapeutic concentration, targeted use, stacking with hydrogen water.",
    note: "Produces the highest dissolved H\u2082 of any consumer method. Echo Hydrogen Enriched Water achieves up to 16 ppm.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M7 3H17L15 21H9L7 3Z"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M7 3H17"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M10 10L11 8L12 10L13 8L14 10"
          stroke="var(--lp-accent)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="9.5"
          y1="14"
          x2="14.5"
          y2="14"
          stroke="var(--lp-accent)"
          strokeWidth="1"
          strokeDasharray="1.5 1.5"
        />
      </svg>
    ),
  },
  {
    name: "Tablets & Stick Packs",
    badge: "Most accessible",
    howItWorks:
      "Magnesium-based tablets react with water to produce H\u2082 gas when dissolved. Drop in a glass, wait, drink.",
    concentration: "0.5 \u2013 1.5 ppm",
    bestFor: "Travel, on-the-go use, getting started.",
    note: "Concentration varies significantly by brand. Most tablets produce lower concentrations than electrolysis devices or powdered mixes.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12"
          cy="12"
          r="8"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          fill="none"
        />
        <line
          x1="12"
          y1="8"
          x2="12"
          y2="16"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="12"
          x2="16"
          y2="12"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    name: "Hydrogen Inhalation",
    badge: "Highest bioavailability",
    howItWorks:
      "Concentrated H\u2082 gas is inhaled through a nasal cannula or mask. The lungs absorb it directly into the bloodstream \u2014 bypassing digestion entirely.",
    concentration:
      "High direct delivery (not measured in ppm \u2014 different metric)",
    bestFor:
      "Wellness centers, clinical and biohacking settings, higher acute exposure.",
    note: "Fastest absorption route. Used in several clinical trials. Devices are larger and require a power source.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M8 16C8 16 6 14 6 11C6 8 8 4 12 4C16 4 18 8 18 11C18 14 16 16 16 16"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M8 16H16V19C16 20.1 15.1 21 14 21H10C8.9 21 8 20.1 8 19V16Z"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    ),
  },
  {
    name: "Hydrogen-Rich Saline (IV)",
    badge: "Clinical only",
    howItWorks:
      "H\u2082 is dissolved in saline and delivered by intravenous infusion.",
    concentration: "Clinical dose \u2014 administered under medical supervision",
    bestFor: "Hospital and clinical research settings only.",
    note: "Not available for home use. Used in acute care studies including post-cardiac arrest and brain injury research.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3V8M12 8L8 12V19C8 20.1 8.9 21 10 21H14C15.1 21 16 20.1 16 19V12L12 8Z"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <line
          x1="8"
          y1="15"
          x2="16"
          y2="15"
          stroke="var(--lp-accent)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      </svg>
    ),
  },
  {
    name: "Topical / Bathing",
    badge: "Localized use",
    howItWorks:
      "H\u2082-rich water applied directly to skin or added to bath water.",
    concentration: "Low \u2014 topical absorption",
    bestFor: "Skin health, localized inflammation, sports injury recovery.",
    note: "Research is limited compared to oral and inhalation routes.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 16C4 16 4 20 8 20H16C20 20 20 16 20 16"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M3 16H21"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M12 4C12 4 9 8 9 10C9 11.7 10.3 13 12 13C13.7 13 15 11.7 15 10C15 8 12 4 12 4Z"
          stroke="var(--lp-accent)"
          strokeWidth="1.5"
          fill="none"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

const comparisonRows = [
  {
    method: "Topical",
    concentration: "Low",
    absorption: "Slow (dermal)",
    accessibility: "Accessible",
    use: "Skin / localized",
  },
  {
    method: "Tablets",
    concentration: "0.5\u20131.5 ppm",
    absorption: "Moderate (digestive)",
    accessibility: "Very accessible",
    use: "Travel / on-the-go",
  },
  {
    method: "Water Machines",
    concentration: "1.0\u20131.5 ppm",
    absorption: "Moderate (digestive)",
    accessibility: "Home device",
    use: "Daily drinking",
  },
  {
    method: "Bottles",
    concentration: "3.0\u20138.0 ppm",
    absorption: "Moderate (digestive)",
    accessibility: "Portable device",
    use: "Travel / personal",
  },
  {
    method: "Powdered Mixes",
    concentration: "10.0\u201316.0+ ppm",
    absorption: "Moderate (digestive)",
    accessibility: "Very accessible",
    use: "Max concentration",
  },
  {
    method: "Inhalation",
    concentration: "High (direct)",
    absorption: "Fast (pulmonary)",
    accessibility: "Specialty device",
    use: "Clinical / biohacking",
  },
  {
    method: "IV Saline",
    concentration: "Clinical dose",
    absorption: "Immediate (IV)",
    accessibility: "Hospital only",
    use: "Acute care research",
  },
];

export default function DeliveryMethodsSection() {
  return (
    <section
      style={{
        background: "var(--lp-surface)",
        padding: "var(--lp-section-pad)",
      }}
    >
      <div style={{ maxWidth: "var(--lp-max-width)", margin: "0 auto" }}>
        <FadeInOnScroll>
          <span className="lp-section-label">DELIVERY METHODS</span>

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
            Seven ways to get molecular hydrogen — and how they compare
          </h2>

          <p
            style={{
              fontSize: 17,
              color: "var(--lp-muted)",
              fontFamily: "var(--lp-font-body)",
              maxWidth: 640,
              lineHeight: 1.8,
              marginBottom: 40,
            }}
          >
            Not all delivery methods produce equal concentrations. The key
            measure is dissolved H₂ — typically measured in parts per million
            (ppm). The studies showing the strongest effects generally used
            concentrations of 1.0 ppm and above.
          </p>
        </FadeInOnScroll>

        {/* Delivery method cards */}
        <div style={{ marginBottom: 48 }}>
          {deliveryMethods.map((method, index) => (
            <FadeInOnScroll key={index} delay={index * 0.05}>
              <div
                className="flex flex-col sm:flex-row"
                style={{
                  background: "#FFFFFF",
                  borderRadius: "var(--lp-radius-md)",
                  boxShadow: "var(--lp-shadow-card)",
                  padding: 24,
                  marginBottom: 16,
                  position: "relative",
                }}
              >
                {/* Badge */}
                <span
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    background: "var(--lp-accent-lt)",
                    color: "var(--lp-accent)",
                    fontSize: 11,
                    fontFamily: "var(--lp-font-body)",
                    fontWeight: 600,
                    borderRadius: 999,
                    padding: "4px 12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {method.badge}
                </span>

                {/* Icon */}
                <div
                  className="shrink-0"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "var(--lp-accent-lt)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 20,
                    marginBottom: 12,
                  }}
                >
                  {method.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, paddingRight: 100 }}>
                  <h3
                    style={{
                      fontFamily: "var(--lp-font-display)",
                      fontWeight: 600,
                      fontSize: 20,
                      color: "var(--lp-primary)",
                      marginBottom: 12,
                    }}
                  >
                    {method.name}
                  </h3>

                  <p
                    style={{
                      fontSize: 15,
                      color: "var(--lp-text)",
                      fontFamily: "var(--lp-font-body)",
                      lineHeight: 1.7,
                      marginBottom: 8,
                    }}
                  >
                    <strong>How it works:</strong> {method.howItWorks}
                  </p>

                  <p
                    style={{
                      fontSize: 15,
                      color: "var(--lp-text)",
                      fontFamily: "var(--lp-font-body)",
                      lineHeight: 1.7,
                      marginBottom: 8,
                    }}
                  >
                    <strong>Typical concentration:</strong>{" "}
                    {method.concentration}
                  </p>

                  <p
                    style={{
                      fontSize: 15,
                      color: "var(--lp-text)",
                      fontFamily: "var(--lp-font-body)",
                      lineHeight: 1.7,
                      marginBottom: 8,
                    }}
                  >
                    <strong>Best for:</strong> {method.bestFor}
                  </p>

                  <p
                    style={{
                      fontSize: 15,
                      color: "var(--lp-muted)",
                      fontFamily: "var(--lp-font-body)",
                      lineHeight: 1.7,
                      fontStyle: "italic",
                    }}
                  >
                    <strong style={{ fontStyle: "normal" }}>Note:</strong>{" "}
                    {method.note}
                  </p>
                </div>
              </div>
            </FadeInOnScroll>
          ))}
        </div>

        {/* Comparison table */}
        <FadeInOnScroll>
          <div style={{ overflowX: "auto", marginBottom: 32 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
                fontFamily: "var(--lp-font-body)",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Method",
                    "Typical H\u2082 Concentration",
                    "Absorption Speed",
                    "Accessibility",
                    "Most Common Use",
                  ].map((header) => (
                    <th
                      key={header}
                      style={{
                        background: "var(--lp-accent-lt)",
                        color: "var(--lp-primary)",
                        fontWeight: 600,
                        padding: "12px 16px",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, index) => (
                  <tr
                    key={index}
                    style={{
                      background:
                        index % 2 === 0 ? "#FFFFFF" : "var(--lp-bg)",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 16px",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.method}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {row.concentration}
                    </td>
                    <td style={{ padding: "10px 16px" }}>{row.absorption}</td>
                    <td style={{ padding: "10px 16px" }}>
                      {row.accessibility}
                    </td>
                    <td style={{ padding: "10px 16px" }}>{row.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeInOnScroll>

        {/* Echo Water bridge note */}
        <FadeInOnScroll delay={0.1}>
          <div
            style={{
              background: "var(--lp-accent-lt)",
              borderLeft: "3px solid var(--lp-accent)",
              borderRadius: "var(--lp-radius-sm)",
              padding: 16,
              fontFamily: "var(--lp-font-body)",
              fontSize: 15,
              color: "var(--lp-text)",
              lineHeight: 1.7,
            }}
          >
            Echo Water offers hydrogen solutions across the full concentration
            spectrum — from the Echo hydrogen water machines for daily use, to
            the Echo Go+ portable bottle, to Echo Hydrogen Enriched Water powder
            at up to 16 ppm. Ready to explore?{" "}
            <a
              href="https://echowater.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--lp-accent)",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Visit echowater.com →
            </a>
          </div>
        </FadeInOnScroll>
      </div>
    </section>
  );
}
