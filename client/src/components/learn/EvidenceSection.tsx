import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCountUp } from "./useCountUp";

const tiers = [
  {
    label: "Animal & lab studies",
    fill: 90,
    color: "#10B981",
    annotation:
      "Extensive — consistent positive results across disease models",
  },
  {
    label: "Small human trials (< 100 participants)",
    fill: 65,
    color: "#F59E0B",
    annotation: "Promising — significant results in multiple conditions",
  },
  {
    label: "Large randomized controlled trials",
    fill: 25,
    color: "#F97316",
    annotation: "Emerging — more large trials needed to confirm",
  },
];

export default function EvidenceSection() {
  const isMobile = useIsMobile();

  const counter1 = useCountUp(1335, 2000);
  const counter2 = useCountUp(200, 2000);
  const counter3 = useCountUp(170, 2000);

  // Intersection observer for bar animation
  const barsRef = useRef<HTMLDivElement>(null);
  const [barsVisible, setBarsVisible] = useState(false);

  useEffect(() => {
    const el = barsRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setBarsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      style={{
        background: "var(--lp-primary)",
        padding: "var(--lp-section-pad)",
      }}
    >
      <div style={{ maxWidth: "var(--lp-max-width)", margin: "0 auto" }}>
        <span
          className="lp-section-label"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          THE SCIENCE
        </span>

        <h2
          style={{
            fontFamily: "var(--lp-font-display)",
            fontWeight: 600,
            fontSize: 44,
            color: "#FFFFFF",
            marginTop: 12,
            marginBottom: 8,
          }}
        >
          How strong is the research?
        </h2>

        <p
          style={{
            fontFamily: "var(--lp-font-body)",
            fontSize: 18,
            color: "#BDD8EE",
            marginBottom: 48,
          }}
        >
          An honest look at where the science stands.
        </p>

        {/* Stat counters */}
        <div
          ref={counter1.ref}
          className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-3"} gap-8`}
          style={{ marginBottom: 48, textAlign: "center" }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--lp-font-display)",
                fontSize: isMobile ? 48 : 72,
                fontWeight: 700,
                color: "#FFFFFF",
                lineHeight: 1,
              }}
            >
              {counter1.count.toLocaleString()}+
            </div>
            <div
              style={{
                fontFamily: "var(--lp-font-body)",
                fontSize: 14,
                fontWeight: 500,
                color: "#BDD8EE",
                marginTop: 8,
              }}
            >
              Peer-Reviewed Studies
            </div>
          </div>

          <div ref={counter2.ref}>
            <div
              style={{
                fontFamily: "var(--lp-font-display)",
                fontSize: isMobile ? 48 : 72,
                fontWeight: 700,
                color: "#FFFFFF",
                lineHeight: 1,
              }}
            >
              {counter2.count.toLocaleString()}+
            </div>
            <div
              style={{
                fontFamily: "var(--lp-font-body)",
                fontSize: 14,
                fontWeight: 500,
                color: "#BDD8EE",
                marginTop: 8,
              }}
            >
              Human Clinical Trials
            </div>
          </div>

          <div ref={counter3.ref}>
            <div
              style={{
                fontFamily: "var(--lp-font-display)",
                fontSize: isMobile ? 48 : 72,
                fontWeight: 700,
                color: "#FFFFFF",
                lineHeight: 1,
              }}
            >
              {counter3.count.toLocaleString()}+
            </div>
            <div
              style={{
                fontFamily: "var(--lp-font-body)",
                fontSize: 14,
                fontWeight: 500,
                color: "#BDD8EE",
                marginTop: 8,
              }}
            >
              Health Conditions Studied
            </div>
          </div>
        </div>

        {/* Context comparison box */}
        <div
          style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: "var(--lp-radius-md)",
            padding: 24,
            textAlign: "center",
            maxWidth: 640,
            margin: "0 auto 48px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--lp-font-body)",
              fontSize: 16,
              color: "#BDD8EE",
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            For context: Omega-3 fatty acids had fewer published human trials at
            this stage of research. Vitamin D's connection to immune health was
            still emerging after 15+ years of study. H&#x2082; research is newer
            — but it is moving exceptionally fast.
          </p>
        </div>

        {/* Evidence tier bars */}
        <div
          ref={barsRef}
          style={{ maxWidth: 700, margin: "0 auto 24px" }}
        >
          {tiers.map((tier, i) => (
            <div
              key={i}
              style={{ marginBottom: 24 }}
            >
              <div
                style={{
                  fontFamily: "var(--lp-font-body)",
                  fontSize: 14,
                  color: "#FFFFFF",
                  marginBottom: 8,
                }}
              >
                {tier.label}
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 9999,
                  height: 10,
                  overflow: "hidden",
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 9999,
                    background: tier.color,
                    width: barsVisible ? `${tier.fill}%` : "0%",
                    transition: "width 1.2s ease-out",
                    transitionDelay: `${i * 0.2}s`,
                  }}
                />
              </div>
              <div
                style={{
                  fontFamily: "var(--lp-font-body)",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                {tier.annotation}
              </div>
            </div>
          ))}
        </div>

        {/* Honest note */}
        <p
          style={{
            fontFamily: "var(--lp-font-body)",
            fontSize: 14,
            color: "rgba(255,255,255,0.65)",
            fontStyle: "italic",
            textAlign: "center",
            maxWidth: 600,
            margin: "24px auto 0",
            lineHeight: 1.7,
          }}
        >
          Most human trials are small and short-term. The breadth of positive
          results across so many different disease models is why the scientific
          community is paying close attention. This is a field in motion.
        </p>
      </div>
    </section>
  );
}
