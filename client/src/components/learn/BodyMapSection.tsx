import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import BodySilhouetteSvg from "./svg/BodySilhouetteSvg";

const organs = [
  {
    name: "Brain",
    description: "Studied for neuroprotection and cognitive support",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2C7 2 3 6 3 11C3 16.5 7.5 21 12 22C16.5 21 21 16.5 21 11C21 6 17 2 12 2Z"
          stroke="var(--lp-accent)"
          strokeWidth="1.8"
          fill="none"
          strokeLinejoin="round"
        />
        <path d="M12 6V18" stroke="var(--lp-accent)" strokeWidth="1.2" />
        <path d="M7 10C9 10 10 8 12 8" stroke="var(--lp-accent)" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M17 10C15 10 14 8 12 8" stroke="var(--lp-accent)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Heart",
    description: "Studied for cardiovascular health and circulation",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 21C12 21 4 15 4 9.5C4 6.5 6.5 4 9 4C10.5 4 11.5 5 12 6C12.5 5 13.5 4 15 4C17.5 4 20 6.5 20 9.5C20 15 12 21 12 21Z"
          stroke="var(--lp-accent)"
          strokeWidth="1.8"
          fill="none"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    name: "Lungs",
    description: "Studied for respiratory and anti-inflammatory effects",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 4V16" stroke="var(--lp-accent)" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M12 8C8 8 5 11 5 15C5 18 6.5 20 9 20H12"
          stroke="var(--lp-accent)"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M12 8C16 8 19 11 19 15C19 18 17.5 20 15 20H12"
          stroke="var(--lp-accent)"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    name: "Liver",
    description: "Studied for metabolic and detoxification support",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 10C5 6 8 4 12 4C18 4 20 8 20 12C20 16 17 20 12 20C8 20 5 17 5 14V10Z"
          stroke="var(--lp-accent)"
          strokeWidth="1.8"
          fill="none"
          strokeLinejoin="round"
        />
        <path d="M12 4V20" stroke="var(--lp-accent)" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    name: "Gut",
    description:
      "H\u2082 naturally produced here. Studied for microbiome health.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M8 4C8 4 6 8 6 12C6 16 8 20 12 20C16 20 18 16 18 12C18 8 16 4 16 4"
          stroke="var(--lp-accent)"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M9 10C11 9 13 11 15 10"
          stroke="var(--lp-accent)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M9 14C11 13 13 15 15 14"
          stroke="var(--lp-accent)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    name: "Muscles",
    description: "Studied for athletic recovery and reduced lactic acid",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M6 12C6 8 8 5 10 5C12 5 12 8 12 12C12 8 12 5 14 5C16 5 18 8 18 12C18 16 16 19 14 19C12 19 12 16 12 12C12 16 12 19 10 19C8 19 6 16 6 12Z"
          stroke="var(--lp-accent)"
          strokeWidth="1.8"
          fill="none"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function BodyMapSection() {
  const isMobile = useIsMobile();
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null);

  const handleHotspotClick = (index: number) => {
    setActiveHotspot(activeHotspot === index ? null : index);
  };

  return (
    <section
      style={{
        background: "var(--lp-bg)",
        padding: "var(--lp-section-pad)",
      }}
    >
      <div style={{ maxWidth: "var(--lp-max-width)", margin: "0 auto" }}>
        <span className="lp-section-label">THE REACH</span>

        <h2
          style={{
            fontFamily: "var(--lp-font-display)",
            fontWeight: 600,
            fontSize: 44,
            color: "var(--lp-primary)",
            marginTop: 12,
            marginBottom: 12,
          }}
        >
          H&#x2082; reaches every corner of your body
        </h2>

        <p
          style={{
            fontFamily: "var(--lp-font-body)",
            fontSize: 18,
            color: "var(--lp-muted)",
            marginBottom: 48,
            maxWidth: 600,
          }}
        >
          Because it is so small, molecular hydrogen travels farther than any
          other molecule. Here are the organs researchers are studying most.
        </p>

        {isMobile ? (
          /* Mobile: horizontal card rows */
          <div className="flex flex-col gap-3">
            {organs.map((organ, i) => (
              <div
                key={i}
                className="flex items-center gap-4"
                style={{
                  background: "#FFFFFF",
                  borderRadius: "var(--lp-radius-md)",
                  padding: "16px 20px",
                  boxShadow: "var(--lp-shadow-card)",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "var(--lp-accent-lt)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {organ.icon}
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--lp-font-body)",
                      fontWeight: 600,
                      fontSize: 16,
                      color: "var(--lp-primary)",
                    }}
                  >
                    {organ.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--lp-font-body)",
                      fontSize: 14,
                      color: "var(--lp-muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    {organ.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: SVG + info card */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 48,
              alignItems: "start",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                maxWidth: 320,
                margin: "0 auto",
              }}
            >
              <BodySilhouetteSvg
                activeHotspot={activeHotspot}
                onHotspotClick={handleHotspotClick}
              />
            </div>

            <div className="flex flex-col gap-3">
              {organs.map((organ, i) => {
                const isActive = activeHotspot === i;
                return (
                  <button
                    key={i}
                    onClick={() => handleHotspotClick(i)}
                    className="flex items-center gap-4 w-full text-left"
                    style={{
                      background: isActive ? "var(--lp-accent-lt)" : "#FFFFFF",
                      borderRadius: "var(--lp-radius-md)",
                      padding: "16px 20px",
                      border: isActive
                        ? "1.5px solid var(--lp-accent)"
                        : "1px solid var(--lp-border)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "var(--lp-accent-lt)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {organ.icon}
                    </div>
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--lp-font-body)",
                          fontWeight: 600,
                          fontSize: 16,
                          color: "var(--lp-primary)",
                        }}
                      >
                        {organ.name}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--lp-font-body)",
                          fontSize: 14,
                          color: "var(--lp-muted)",
                          lineHeight: 1.5,
                        }}
                      >
                        {organ.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
