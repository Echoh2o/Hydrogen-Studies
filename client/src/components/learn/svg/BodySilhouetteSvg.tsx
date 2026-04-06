interface BodySilhouetteSvgProps {
  activeHotspot: number | null;
  onHotspotClick: (index: number) => void;
}

const hotspots = [
  { cx: 150, cy: 45, label: "Brain" },
  { cx: 135, cy: 145, label: "Heart" },
  { cx: 150, cy: 130, label: "Lungs" },
  { cx: 120, cy: 175, label: "Liver" },
  { cx: 150, cy: 210, label: "Gut" },
  { cx: 150, cy: 300, label: "Muscles" },
];

export default function BodySilhouetteSvg({
  activeHotspot,
  onHotspotClick,
}: BodySilhouetteSvgProps) {
  return (
    <svg
      viewBox="0 0 300 400"
      width="100%"
      height="auto"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Genderless body silhouette outline */}
      <path
        d={[
          // Head
          "M 150 15",
          "C 125 15, 115 30, 115 50",
          "C 115 70, 130 82, 150 82",
          "C 170 82, 185 70, 185 50",
          "C 185 30, 175 15, 150 15 Z",
          // Neck
          "M 140 82 L 140 95 L 160 95 L 160 82",
          // Torso + shoulders + arms
          "M 140 95",
          "L 100 105",   // left shoulder
          "L 80 110",    // outer shoulder
          "L 65 155",    // upper left arm
          "L 55 200",    // forearm
          "L 50 230",    // wrist
          "L 45 245",    // hand
          "L 55 248",    // hand bottom
          "L 62 235",    // hand return
          "L 70 200",    // inner forearm
          "L 82 155",    // inner upper arm
          "L 95 120",    // armpit
          "L 95 240",    // left torso
          "L 100 260",   // left hip
          "L 105 310",   // left thigh
          "L 108 340",   // left knee
          "L 110 370",   // left shin
          "L 105 390",   // left ankle
          "L 95 395",    // left foot
          "L 120 395",   // left foot front
          "L 125 388",   // left foot arch
          "L 128 370",   // inner left shin
          "L 130 340",   // inner left knee
          "L 135 310",   // inner left thigh
          "L 140 270",   // inner left hip
          "L 150 260",   // crotch center
          "L 160 270",   // inner right hip
          "L 165 310",   // inner right thigh
          "L 170 340",   // inner right knee
          "L 172 370",   // inner right shin
          "L 175 388",   // right foot arch
          "L 180 395",   // right foot front
          "L 205 395",   // right foot
          "L 195 390",   // right ankle
          "L 190 370",   // right shin
          "L 192 340",   // right knee
          "L 195 310",   // right thigh
          "L 200 260",   // right hip
          "L 205 240",   // right torso
          "L 205 120",   // armpit right
          "L 218 155",   // inner right upper arm
          "L 230 200",   // inner right forearm
          "L 238 235",   // right hand return
          "L 245 248",   // right hand bottom
          "L 250 245",   // right hand
          "L 245 230",   // right wrist
          "L 235 200",   // right forearm
          "L 220 155",   // right upper arm
          "L 200 105",   // right shoulder
          "L 160 95",    // back to neck
        ].join(" ")}
        fill="transparent"
        stroke="#E2E8F0"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Hotspot dots */}
      {hotspots.map((spot, i) => {
        const isActive = activeHotspot === i;
        return (
          <g key={i} style={{ cursor: "pointer" }} onClick={() => onHotspotClick(i)}>
            <circle
              cx={spot.cx}
              cy={spot.cy}
              r={isActive ? 11 : 8}
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
