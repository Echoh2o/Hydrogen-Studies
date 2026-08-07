import { FadeInOnScroll } from "@/components/animations/ScrollAnimations";
import { useQuery } from "@tanstack/react-query";
import { buildEchoUrl } from "@shared/echo-products";
import { trackOutboundClick } from "@/lib/analytics";

const echoStoreUrl = buildEchoUrl("/", { content: "learn-dual-cta" });

const categoryChips = [
  "Brain",
  "Heart",
  "Inflammation",
  "Metabolism",
  "Cancer",
  "Athletic Performance",
  "Aging",
  "Gut Health",
];

export default function DualCtaSection() {
  const { data: stats } = useQuery<{ totalStudies: number; humanTrials: number; healthConditions: number }>({
    queryKey: ["/api/learn-stats"],
  });

  return (
    <section style={{ background: "var(--lp-bg)", padding: "80px 24px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <FadeInOnScroll>
          <h2
            style={{
              fontFamily: "var(--lp-font-display)",
              fontWeight: 600,
              fontSize: 44,
              color: "var(--lp-primary)",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            You are ready for what comes next
          </h2>

          <p
            className="mb-12"
            style={{
              fontSize: 18,
              color: "var(--lp-muted)",
              textAlign: "center",
              fontFamily: "var(--lp-font-body)",
            }}
          >
            Two paths from here — whichever fits where you are.
          </p>
        </FadeInOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1 — Browse the Science */}
          <FadeInOnScroll delay={0.1}>
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "var(--lp-radius-lg)",
                boxShadow: "var(--lp-shadow-card)",
                padding: "36px 32px",
                border: "0.5px solid var(--lp-border)",
                textAlign: "center",
              }}
            >
              {/* Book / database icon */}
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                style={{ margin: "0 auto 16px", display: "block" }}
              >
                <rect
                  x="6"
                  y="4"
                  width="28"
                  height="32"
                  rx="3"
                  stroke="var(--lp-accent)"
                  strokeWidth="2"
                  fill="none"
                />
                <line
                  x1="14"
                  y1="4"
                  x2="14"
                  y2="36"
                  stroke="var(--lp-accent)"
                  strokeWidth="2"
                />
                <line
                  x1="19"
                  y1="12"
                  x2="28"
                  y2="12"
                  stroke="var(--lp-accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <line
                  x1="19"
                  y1="17"
                  x2="28"
                  y2="17"
                  stroke="var(--lp-accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <line
                  x1="19"
                  y1="22"
                  x2="25"
                  y2="22"
                  stroke="var(--lp-accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>

              <h3
                style={{
                  fontFamily: "var(--lp-font-display)",
                  fontWeight: 600,
                  fontSize: 22,
                  color: "var(--lp-primary)",
                  marginBottom: 8,
                }}
              >
                Browse the research database
              </h3>

              <p
                style={{
                  fontSize: 15,
                  color: "var(--lp-muted)",
                  fontFamily: "var(--lp-font-body)",
                  lineHeight: 1.6,
                  marginBottom: 16,
                }}
              >
                {stats?.totalStudies?.toLocaleString() || "1,335"}+ peer-reviewed studies. Filter by health condition,
                delivery method, or study type.
              </p>

              <div
                className="flex flex-wrap justify-center gap-2"
                style={{ marginBottom: 20 }}
              >
                {categoryChips.map((chip) => (
                  <a
                    key={chip}
                    href="/studies"
                    style={{
                      background: "var(--lp-accent-lt)",
                      color: "var(--lp-accent)",
                      fontSize: 12,
                      fontFamily: "var(--lp-font-body)",
                      fontWeight: 500,
                      borderRadius: 999,
                      padding: "4px 12px",
                      textDecoration: "none",
                      display: "inline-block",
                    }}
                  >
                    {chip}
                  </a>
                ))}
              </div>

              <a
                href="/studies"
                className="block w-full"
                style={{
                  background: "var(--lp-primary)",
                  color: "#FFFFFF",
                  borderRadius: "var(--lp-radius-sm)",
                  fontFamily: "var(--lp-font-body)",
                  fontWeight: 600,
                  fontSize: 15,
                  padding: "14px 0",
                  textAlign: "center",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                Open the Database →
              </a>
            </div>
          </FadeInOnScroll>

          {/* Card 2 — Try It */}
          <FadeInOnScroll delay={0.2}>
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "var(--lp-radius-lg)",
                boxShadow: "var(--lp-shadow-card)",
                padding: "36px 32px",
                border: "0.5px solid var(--lp-border)",
                textAlign: "center",
              }}
            >
              {/* Water drop icon */}
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                style={{ margin: "0 auto 16px", display: "block" }}
              >
                <path
                  d="M20 6C20 6 10 18 10 24C10 29.5228 14.4772 34 20 34C25.5228 34 30 29.5228 30 24C30 18 20 6 20 6Z"
                  stroke="var(--lp-accent)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinejoin="round"
                />
                <path
                  d="M16 26C16 26 17 28 20 28"
                  stroke="var(--lp-accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>

              <h3
                style={{
                  fontFamily: "var(--lp-font-display)",
                  fontWeight: 600,
                  fontSize: 22,
                  color: "var(--lp-primary)",
                  marginBottom: 8,
                }}
              >
                Try molecular hydrogen yourself
              </h3>

              <p
                style={{
                  fontSize: 15,
                  color: "var(--lp-muted)",
                  fontFamily: "var(--lp-font-body)",
                  lineHeight: 1.6,
                  marginBottom: 24,
                }}
              >
                Echo Water makes hydrogen water devices designed to match the
                concentrations used in clinical research.
              </p>

              <a
                href={echoStoreUrl}
                target="_blank"
                rel="noopener"
                onClick={() => trackOutboundClick(echoStoreUrl, "learn-dual-cta")}
                className="block w-full"
                style={{
                  background: "var(--lp-accent)",
                  color: "#FFFFFF",
                  borderRadius: "var(--lp-radius-sm)",
                  fontFamily: "var(--lp-font-body)",
                  fontWeight: 600,
                  fontSize: 15,
                  padding: "14px 0",
                  textAlign: "center",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                Visit echowater.com →
              </a>
            </div>
          </FadeInOnScroll>
        </div>

        {/* Attribution footer */}
        <FadeInOnScroll delay={0.3}>
          <p
            className="mt-10"
            style={{
              fontSize: 13,
              color: "var(--lp-muted)",
              textAlign: "center",
              fontFamily: "var(--lp-font-body)",
              lineHeight: 1.7,
            }}
          >
            hydrogenstudies.com is maintained by Dr. Paul Barattiero as a
            non-commercial scientific resource. All studies are third-party
            peer-reviewed research. No curative claims are made. Site content is
            for educational purposes only.
          </p>
        </FadeInOnScroll>
      </div>
    </section>
  );
}
