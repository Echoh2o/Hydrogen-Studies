import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { useCountUp } from "./useCountUp";

const tiers = [
  {
    label: "Animal & lab studies",
    fill: 90,
    color: "#10B981",
    annotation:
      "Extensive — mostly positive, but animal results often don't hold in people",
  },
  {
    label: "Small human trials (< 100 participants)",
    fill: 65,
    color: "#F59E0B",
    annotation: "Mixed — some positive results, many small or short",
  },
  {
    label: "Large randomized controlled trials",
    fill: 25,
    color: "#F97316",
    annotation: "Few — and several found no clear effect",
  },
];

export default function EvidenceSection() {
  const isMobile = useIsMobile();
  const { data: stats } = useQuery<{ totalStudies: number; humanTrials: number; healthConditions: number }>({
    queryKey: ["/api/learn-stats"],
  });

  const counter1 = useCountUp(stats?.totalStudies || 2000, 2000);
  const counter2 = useCountUp(stats?.humanTrials || 200, 2000);
  const counter3 = useCountUp(stats?.healthConditions || 170, 2000);

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
            Most of the research so far is in animals and cells. Results there
            often don't carry over to people, which is why the human trials
            below matter most.
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
          Most human trials are small and short-term, and several of the
          larger ones found little or no difference from placebo. Each topic
          page grades the evidence and lists the null results too.
        </p>
      </div>
    </section>
  );
}
