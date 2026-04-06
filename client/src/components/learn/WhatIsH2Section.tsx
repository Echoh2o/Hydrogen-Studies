import { useIsMobile } from "@/hooks/use-mobile";
import MoleculeComparisonSvg from "./svg/MoleculeComparisonSvg";

export default function WhatIsH2Section() {
  const isMobile = useIsMobile();

  return (
    <section
      id="what-is-h2"
      style={{
        background: "var(--lp-bg)",
        padding: "var(--lp-section-pad)",
      }}
    >
      <div style={{ maxWidth: "var(--lp-max-width)", margin: "0 auto" }}>
        <span className="lp-section-label">MOLECULAR HYDROGEN 101</span>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: 48,
            alignItems: "start",
            marginTop: 16,
          }}
        >
          {/* Text column */}
          <div>
            <h2
              style={{
                fontFamily: "var(--lp-font-display)",
                fontWeight: 600,
                fontSize: 44,
                color: "var(--lp-primary)",
                marginBottom: 24,
              }}
            >
              What exactly is molecular hydrogen?
            </h2>

            <div
              style={{
                fontFamily: "var(--lp-font-body)",
                fontSize: 17,
                lineHeight: 1.8,
                color: "var(--lp-text)",
              }}
            >
              <p style={{ marginBottom: 20 }}>
                You already know water — H&#x2082;O. That's two hydrogen atoms
                bonded to one oxygen atom.
              </p>
              <p style={{ marginBottom: 20 }}>
                Molecular hydrogen is just H&#x2082; — two hydrogen atoms bonded
                together, floating free. No oxygen attached.
              </p>
              <p style={{ marginBottom: 20 }}>
                It is the lightest molecule on Earth. Colorless. Tasteless.
                Odorless. You would never know it was there.
              </p>
              <p style={{ marginBottom: 20 }}>
                Here is something that surprises most people: your body already
                makes it. When gut bacteria break down dietary fiber, they
                produce hydrogen gas. You have had H&#x2082; inside you your
                whole life.
              </p>
              <p style={{ marginBottom: 0 }}>
                Scientists are now studying what happens when you get more of it
                — deliberately.
              </p>
            </div>
          </div>

          {/* SVG column */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              order: isMobile ? -1 : 0,
            }}
          >
            <MoleculeComparisonSvg />
          </div>
        </div>

        {/* Fact callout box */}
        <div
          style={{
            background: "var(--lp-accent-lt)",
            borderRadius: "var(--lp-radius-md)",
            padding: "20px 24px",
            borderLeft: "3px solid var(--lp-accent)",
            marginTop: 40,
          }}
        >
          <p
            style={{
              fontFamily: "var(--lp-font-body)",
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--lp-text)",
              margin: 0,
            }}
          >
            &#x1F4A1;&nbsp;&nbsp;Your gut produces hydrogen gas naturally every
            day — roughly 100–500ml. Researchers noticed that people with gut
            bacteria that produce more H&#x2082; tend to show lower markers of
            oxidative stress. This is part of what sparked scientific interest in
            H&#x2082; therapy.
          </p>
        </div>
      </div>
    </section>
  );
}
