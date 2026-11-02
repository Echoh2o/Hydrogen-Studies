import { FadeInOnScroll } from "@/components/animations/ScrollAnimations";
import { useQuery } from "@tanstack/react-query";

export default function TldrSection() {
  const { data: stats } = useQuery<{ totalStudies: number; humanTrials: number; healthConditions: number }>({
    queryKey: ["/api/learn-stats"],
  });
  return (
    <section
      style={{
        background: "var(--lp-primary)",
        padding: "var(--lp-section-pad)",
      }}
    >
      <div style={{ maxWidth: "var(--lp-max-width)", margin: "0 auto" }}>
        <FadeInOnScroll>
          <span
            className="lp-section-label"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            THE SHORT VERSION
          </span>

          <h2
            style={{
              fontFamily: "var(--lp-font-display)",
              fontWeight: 600,
              fontSize: 40,
              color: "#FFFFFF",
              marginTop: 12,
              marginBottom: 8,
            }}
          >
            The whole page in 90 seconds
          </h2>

          <p
            style={{
              fontSize: 16,
              color: "#BDD8EE",
              fontFamily: "var(--lp-font-body)",
              marginBottom: 40,
            }}
          >
            Everything you need to explain molecular hydrogen to someone else.
          </p>
        </FadeInOnScroll>

        <FadeInOnScroll delay={0.15}>
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto",
              fontFamily: "var(--lp-font-body)",
              color: "#E2EEF7",
              lineHeight: 1.9,
            }}
            className="text-base md:text-lg"
          >
            <p style={{ marginBottom: 24 }}>
              Your body produces unstable particles every day called free
              radicals. Over time, they damage your cells — a process called
              oxidative stress. Think of it like your body slowly rusting from
              the inside.
            </p>

            <p style={{ marginBottom: 24 }}>
              Molecular hydrogen (H₂) is a tiny gas molecule that acts as a mild
              antioxidant in lab and animal studies. Because it is so small, it
              diffuses easily through cells and tissues, including the brain.
            </p>

            <p style={{ marginBottom: 24 }}>
              Your body already produces H₂ naturally — gut bacteria make it
              when digesting fiber. Scientists are now studying what happens when
              you increase your intake deliberately.
            </p>

            <p style={{ marginBottom: 24 }}>
              More than {stats?.totalStudies?.toLocaleString("en-US") || "2,000"} studies have been published since the first major H₂
              paper appeared in <em>Nature Medicine</em> in 2007 — most of them
              in animals or cells. The most studied topics include fatigue,
              brain health, heart health, inflammation, metabolism and exercise
              recovery.
            </p>

            <p style={{ marginBottom: 24 }}>
              H₂ can be taken as hydrogen water (made by a machine, bottle,
              tablet or powder), by inhalation, or in baths. Most human drinking
              trials used roughly 0.5 to 1.6 ppm.
            </p>

            <p style={{ marginBottom: 0 }}>
              The science is still early: human trials are mostly small and
              short, and results are mixed. Hydrogen is not a treatment for any
              disease.
            </p>
          </div>
        </FadeInOnScroll>

        <FadeInOnScroll delay={0.25}>
          <hr
            style={{
              border: "none",
              borderTop: "1px solid rgba(255,255,255,0.15)",
              marginTop: 48,
              marginBottom: 24,
            }}
          />
          <p
            style={{
              color: "#8EC8E8",
              fontSize: 14,
              textAlign: "center",
              fontFamily: "var(--lp-font-body)",
            }}
          >
            Everything above is backed by peer-reviewed research.{" "}
            <a
              href="/studies"
              style={{
                color: "#8EC8E8",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Browse the studies →
            </a>
          </p>
        </FadeInOnScroll>
      </div>
    </section>
  );
}
