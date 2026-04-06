import { useIsMobile } from "@/hooks/use-mobile";
import CellComparisonSvg from "./svg/CellComparisonSvg";

export default function OxidativeStressSection() {
  const isMobile = useIsMobile();

  return (
    <section
      style={{
        background: "var(--lp-surface)",
        padding: "var(--lp-section-pad)",
      }}
    >
      <div style={{ maxWidth: "var(--lp-max-width)", margin: "0 auto" }}>
        <span className="lp-section-label">THE PROBLEM</span>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: 48,
            alignItems: "start",
            marginTop: 16,
          }}
        >
          {/* Illustration column (left on desktop, top on mobile) */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              order: isMobile ? -1 : 0,
            }}
          >
            <CellComparisonSvg />
          </div>

          {/* Text column (right on desktop, bottom on mobile) */}
          <div style={{ order: isMobile ? 0 : 0 }}>
            <h2
              style={{
                fontFamily: "var(--lp-font-display)",
                fontWeight: 600,
                fontSize: 44,
                color: "var(--lp-primary)",
                marginBottom: 24,
              }}
            >
              Your cells are under attack every day
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
                Every time you breathe, move, or even think, your body produces
                tiny unstable particles called free radicals.
              </p>
              <p style={{ marginBottom: 20 }}>
                Free radicals are missing an electron. They grab electrons from
                whatever is nearby — including your healthy cells. This damages
                them.
              </p>
              <p style={{ marginBottom: 20 }}>
                Scientists call the buildup of this damage oxidative stress.
              </p>
              <p style={{ marginBottom: 20 }}>
                Think of a cut apple turning brown. That is oxidative stress
                happening right in front of you. The same process happens inside
                your body — you just cannot see it.
              </p>
              <p style={{ marginBottom: 20 }}>
                Over time, oxidative stress builds up. Research links it to
                accelerated aging, low energy, chronic inflammation, and dozens
                of serious diseases.
              </p>
              <p style={{ marginBottom: 0 }}>
                The good news: your body has defenses. And molecular hydrogen is
                one of the most powerful natural tools scientists have found.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
