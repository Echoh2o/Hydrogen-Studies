import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import H2MoleculeSvg from "./svg/H2MoleculeSvg";

export default function LearnHero() {
  const isMobile = useIsMobile();
  const { data: stats } = useQuery<{ totalStudies: number; humanTrials: number; healthConditions: number }>({
    queryKey: ["/api/learn-stats"],
  });

  return (
    <section
      style={{
        background:
          "linear-gradient(135deg, #0A4B7C 0%, #0D3B6E 60%, #071F3A 100%)",
        paddingTop: 100,
        paddingBottom: 80,
        paddingLeft: 24,
        paddingRight: 24,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          alignItems: "center",
          gap: 48,
        }}
      >
        {/* Text column */}
        <div>
          {/* Trust badge */}
          <span
            style={{
              display: "inline-block",
              background: "rgba(255,255,255,0.1)",
              color: "#FFFFFF",
              fontSize: 12,
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 20,
              padding: "4px 14px",
              fontFamily: "var(--lp-font-body)",
              marginBottom: 24,
            }}
          >
            hydrogenstudies.com — peer-reviewed science only. No products. No
            ads.
          </span>

          {/* Headline */}
          <h1
            style={{
              fontFamily: "var(--lp-font-display)",
              fontWeight: 600,
              fontSize: isMobile ? 40 : 62,
              color: "#FFFFFF",
              lineHeight: 1.1,
              marginBottom: 20,
            }}
          >
            Your cells are under attack every day. Scientists found the world's
            smallest defender.
          </h1>

          {/* Subhead */}
          <p
            style={{
              fontFamily: "var(--lp-font-body)",
              fontSize: 19,
              color: "#BDD8EE",
              lineHeight: 1.6,
              maxWidth: 560,
              marginBottom: 32,
            }}
          >
            Molecular hydrogen (H&#x2082;) is being studied in {stats?.totalStudies?.toLocaleString() || "1,335"}+ peer-reviewed trials across {stats?.healthConditions || "170"}+ health conditions. Here's what
            scientists are finding — in plain English.
          </p>

          {/* CTA button */}
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() =>
                document
                  .getElementById("what-is-h2")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              style={{
                background: "var(--lp-accent)",
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: 500,
                fontFamily: "var(--lp-font-body)",
                padding: "14px 32px",
                borderRadius: 40,
                border: "none",
                cursor: "pointer",
              }}
            >
              Start Learning ↓
            </button>

            {/* Secondary link */}
            <a
              href="/studies"
              style={{
                color: "#FFFFFF",
                fontSize: 14,
                fontFamily: "var(--lp-font-body)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.textDecoration = "underline")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.textDecoration = "none")
              }
            >
              Browse all {stats?.totalStudies?.toLocaleString() || "1,335"}+ Studies →
            </a>
          </div>
        </div>

        {/* Graphic column */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <H2MoleculeSvg />
        </div>
      </div>
    </section>
  );
}
