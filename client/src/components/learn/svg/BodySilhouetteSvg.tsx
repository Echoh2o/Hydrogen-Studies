interface BodySilhouetteSvgProps {
  activeHotspot: number | null;
  onHotspotClick: (index: number) => void;
}

const hotspots = [
  { cx: 200, cy: 60, label: "Brain" },
  { cx: 185, cy: 195, label: "Heart" },
  { cx: 210, cy: 175, label: "Lungs" },
  { cx: 170, cy: 230, label: "Liver" },
  { cx: 200, cy: 275, label: "Gut" },
  { cx: 200, cy: 420, label: "Muscles" },
];

export default function BodySilhouetteSvg({
  activeHotspot,
  onHotspotClick,
}: BodySilhouetteSvgProps) {
  return (
    <svg
      viewBox="0 0 400 560"
      width="100%"
      height="auto"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Anatomical body silhouette — genderless standing figure */}
      {/* Head */}
      <ellipse
        cx="200"
        cy="52"
        rx="32"
        ry="38"
        fill="none"
        stroke="#CBD5E1"
        strokeWidth="1.8"
      />
      {/* Neck */}
      <path
        d="M188 89 L188 105 L212 105 L212 89"
        fill="none"
        stroke="#CBD5E1"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Torso */}
      <path
        d="M188 105 Q155 112 130 118 Q115 122 108 135 L108 140 Q112 148 118 155 L128 190 L132 220 Q133 235 135 250 L138 270 Q140 280 145 290 L148 300"
        fill="none"
        stroke="#CBD5E1"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M212 105 Q245 112 270 118 Q285 122 292 135 L292 140 Q288 148 282 155 L272 190 L268 220 Q267 235 265 250 L262 270 Q260 280 255 290 L252 300"
        fill="none"
        stroke="#CBD5E1"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Waist connection */}
      <path
        d="M148 300 Q155 310 165 315 Q180 320 200 322 Q220 320 235 315 Q245 310 252 300"
        fill="none"
        stroke="#CBD5E1"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Left arm */}
      <path
        d="M130 118 Q115 125 105 138 L88 180 Q78 210 72 240 L65 270 Q62 282 58 290 Q55 298 60 302 Q65 305 70 300 L78 280 Q85 255 92 235 L105 195"
        fill="none"
        stroke="#CBD5E1"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right arm */}
      <path
        d="M270 118 Q285 125 295 138 L312 180 Q322 210 328 240 L335 270 Q338 282 342 290 Q345 298 340 302 Q335 305 330 300 L322 280 Q315 255 308 235 L295 195"
        fill="none"
        stroke="#CBD5E1"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Left leg */}
      <path
        d="M165 315 Q160 330 155 350 L148 390 Q145 410 142 430 L138 460 Q136 475 135 490 L132 510 Q130 525 128 535 Q126 542 130 545 Q138 548 145 545 L155 540 Q158 535 158 525 L160 490 Q162 470 165 450 L170 420 Q175 395 180 370 L185 350"
        fill="none"
        stroke="#CBD5E1"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right leg */}
      <path
        d="M235 315 Q240 330 245 350 L252 390 Q255 410 258 430 L262 460 Q264 475 265 490 L268 510 Q270 525 272 535 Q274 542 270 545 Q262 548 255 545 L245 540 Q242 535 242 525 L240 490 Q238 470 235 450 L230 420 Q225 395 220 370 L215 350"
        fill="none"
        stroke="#CBD5E1"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Chest line */}
      <path
        d="M148 160 Q175 175 200 178 Q225 175 252 160"
        fill="none"
        stroke="#CBD5E1"
        strokeWidth="0.8"
        strokeDasharray="4 4"
        opacity="0.5"
      />

      {/* Hotspot dots */}
      {hotspots.map((spot, i) => {
        const isActive = activeHotspot === i;
        return (
          <g
            key={i}
            style={{ cursor: "pointer" }}
            onClick={() => onHotspotClick(i)}
          >
            <circle
              cx={spot.cx}
              cy={spot.cy}
              r={isActive ? 12 : 9}
              fill={isActive ? "#0E6B8D" : "#1A7FA8"}
              opacity={isActive ? 1 : 0.85}
              style={{
                animation: "lp-pulse-dot 2s ease-in-out infinite",
                animationDelay: `${i * 0.3}s`,
                transition: "r 0.2s ease, opacity 0.2s ease",
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
