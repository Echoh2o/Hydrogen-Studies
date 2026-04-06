import MembraneSvg from "./svg/MembraneSvg";

export default function WhyH2DifferentSection() {
  return (
    <section
      style={{
        background: "var(--lp-accent-lt)",
        padding: "var(--lp-section-pad)",
      }}
    >
      <div style={{ maxWidth: "var(--lp-max-width)", margin: "0 auto" }}>
        <span className="lp-section-label">THE SOLUTION</span>

        <h2
          style={{
            fontFamily: "var(--lp-font-display)",
            fontWeight: 600,
            fontSize: 44,
            color: "var(--lp-primary)",
            marginTop: 12,
            marginBottom: 32,
          }}
        >
          H&#x2082; does something no vitamin can
        </h2>

        {/* Three-column stat bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ marginBottom: 40 }}>
          {/* Stat 1 — Smallest */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "var(--lp-radius-md)",
              padding: 20,
              boxShadow: "var(--lp-shadow-card)",
              textAlign: "center",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style={{ margin: "0 auto 10px", display: "block" }}
            >
              <circle cx="8" cy="12" r="5" stroke="var(--lp-accent)" strokeWidth="1.8" fill="none" />
              <circle cx="16" cy="12" r="5" stroke="var(--lp-accent)" strokeWidth="1.8" fill="none" />
            </svg>
            <div
              style={{
                fontFamily: "var(--lp-font-display)",
                fontWeight: 700,
                fontSize: 20,
                color: "var(--lp-primary)",
              }}
            >
              Smallest
            </div>
            <div
              style={{
                fontFamily: "var(--lp-font-body)",
                fontSize: 14,
                color: "var(--lp-muted)",
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              molecule in existence — 500× smaller than Vitamin C
            </div>
          </div>

          {/* Stat 2 — Selective */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "var(--lp-radius-md)",
              padding: 20,
              boxShadow: "var(--lp-shadow-card)",
              textAlign: "center",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style={{ margin: "0 auto 10px", display: "block" }}
            >
              <circle cx="12" cy="12" r="10" stroke="var(--lp-accent)" strokeWidth="1.8" fill="none" />
              <circle cx="12" cy="12" r="6" stroke="var(--lp-accent)" strokeWidth="1.5" fill="none" />
              <circle cx="12" cy="12" r="2.5" fill="var(--lp-accent)" />
            </svg>
            <div
              style={{
                fontFamily: "var(--lp-font-display)",
                fontWeight: 700,
                fontSize: 20,
                color: "var(--lp-primary)",
              }}
            >
              Selective
            </div>
            <div
              style={{
                fontFamily: "var(--lp-font-body)",
                fontSize: 14,
                color: "var(--lp-muted)",
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              targets only the most harmful free radicals
            </div>
          </div>

          {/* Stat 3 — Crosses */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "var(--lp-radius-md)",
              padding: 20,
              boxShadow: "var(--lp-shadow-card)",
              textAlign: "center",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style={{ margin: "0 auto 10px", display: "block" }}
            >
              <path
                d="M12 2C7 2 3 6 3 11C3 16.5 7.5 21 12 22C16.5 21 21 16.5 21 11C21 6 17 2 12 2Z"
                stroke="var(--lp-accent)"
                strokeWidth="1.8"
                fill="none"
                strokeLinejoin="round"
              />
              <path
                d="M12 6C9.5 6 7.5 8 7.5 10.5C7.5 13 9 15 12 17C15 15 16.5 13 16.5 10.5C16.5 8 14.5 6 12 6Z"
                stroke="var(--lp-accent)"
                strokeWidth="1.3"
                fill="none"
                strokeLinejoin="round"
              />
            </svg>
            <div
              style={{
                fontFamily: "var(--lp-font-display)",
                fontWeight: 700,
                fontSize: 20,
                color: "var(--lp-primary)",
              }}
            >
              Crosses
            </div>
            <div
              style={{
                fontFamily: "var(--lp-font-body)",
                fontSize: 14,
                color: "var(--lp-muted)",
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              the blood-brain barrier — most antioxidants cannot
            </div>
          </div>
        </div>

        {/* Body text */}
        <div
          style={{
            fontFamily: "var(--lp-font-body)",
            fontSize: 17,
            lineHeight: 1.8,
            color: "var(--lp-text)",
            maxWidth: 720,
            marginBottom: 40,
          }}
        >
          <p style={{ marginBottom: 20 }}>
            Most antioxidants — like Vitamin C — are large molecules. They have
            trouble getting inside your cells. They cannot reach your
            mitochondria (your cells' power plants). They cannot cross into your
            brain.
          </p>
          <p style={{ marginBottom: 20 }}>
            H&#x2082; is different because it is the world's smallest molecule.
            It slips through cell walls like they are not there. It reaches your
            mitochondria. It crosses the blood-brain barrier.
          </p>
          <p style={{ marginBottom: 20 }}>
            And here is what makes scientists especially excited: H&#x2082; only
            neutralizes the most harmful free radicals — the ones called
            hydroxyl radicals and peroxynitrite. It leaves behind the free
            radicals your body actually needs for immune defense and cell
            signaling.
          </p>
          <p style={{ marginBottom: 0 }}>
            Scientists call this selective antioxidation. It is rare. It matters.
            And it is one of the main reasons H&#x2082; research has grown so
            fast.
          </p>
        </div>

        {/* Membrane SVG */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <MembraneSvg />
        </div>
      </div>
    </section>
  );
}
