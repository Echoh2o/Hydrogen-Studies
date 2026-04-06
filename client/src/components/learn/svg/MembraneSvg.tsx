export default function MembraneSvg() {
  return (
    <svg
      viewBox="0 0 500 250"
      width="100%"
      height="auto"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker
          id="membraneArrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 Z" fill="#6B7280" />
        </marker>
        <marker
          id="h2Arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 Z" fill="#1A7FA8" />
        </marker>
      </defs>

      {/* --- Cell membrane band --- */}
      <rect
        x="0"
        y="100"
        width="500"
        height="20"
        fill="#F1F5F9"
        stroke="#94A3B8"
        strokeWidth="1.5"
        strokeDasharray="8 4"
      />
      <text
        x="250"
        y="95"
        textAnchor="middle"
        fill="#6B7280"
        fontSize="12"
        fontFamily="sans-serif"
      >
        Cell membrane
      </text>

      {/* --- Left: Vitamin C blocked --- */}
      <g>
        {/* Vitamin C circle */}
        <circle
          cx="100"
          cy="60"
          r="30"
          fill="#FEF9C3"
          stroke="#EAB308"
          strokeWidth="1.5"
        />
        <text
          x="100"
          y="56"
          textAnchor="middle"
          fill="#92400E"
          fontSize="10"
          fontFamily="sans-serif"
        >
          Vitamin
        </text>
        <text
          x="100"
          y="69"
          textAnchor="middle"
          fill="#92400E"
          fontSize="10"
          fontFamily="sans-serif"
        >
          C
        </text>

        {/* Arrow pointing down, stopping at membrane */}
        <line
          x1="100"
          y1="92"
          x2="100"
          y2="99"
          stroke="#6B7280"
          strokeWidth="1.5"
          markerEnd="url(#membraneArrow)"
        />

        {/* X mark */}
        <g transform="translate(140, 100)">
          <line x1="-6" y1="-6" x2="6" y2="6" stroke="#DC2626" strokeWidth="2.5" />
          <line x1="6" y1="-6" x2="-6" y2="6" stroke="#DC2626" strokeWidth="2.5" />
        </g>

        {/* Label */}
        <text
          x="145"
          y="85"
          textAnchor="start"
          fill="#DC2626"
          fontSize="12"
          fontFamily="sans-serif"
        >
          stopped here
        </text>
      </g>

      {/* --- Right: H2 passes through --- */}
      <g>
        {/* H2 molecule (small paired dots) above membrane */}
        <circle cx="340" cy="60" r="10" fill="#1A7FA8" opacity="0.6" />
        <circle cx="360" cy="60" r="10" fill="#1A7FA8" opacity="0.6" />
        <text
          x="340"
          y="64"
          textAnchor="middle"
          fill="white"
          fontSize="9"
          fontFamily="'Fraunces', Georgia, serif"
        >
          H
        </text>
        <text
          x="360"
          y="64"
          textAnchor="middle"
          fill="white"
          fontSize="9"
          fontFamily="'Fraunces', Georgia, serif"
        >
          H
        </text>

        {/* Dashed arrow going through membrane */}
        <line
          x1="350"
          y1="72"
          x2="350"
          y2="155"
          stroke="#1A7FA8"
          strokeWidth="1.5"
          strokeDasharray="5 3"
          markerEnd="url(#h2Arrow)"
        />

        {/* H2 molecule copy below membrane */}
        <circle cx="340" cy="170" r="10" fill="#1A7FA8" opacity="0.4" />
        <circle cx="360" cy="170" r="10" fill="#1A7FA8" opacity="0.4" />
        <text
          x="340"
          y="174"
          textAnchor="middle"
          fill="white"
          fontSize="9"
          fontFamily="'Fraunces', Georgia, serif"
        >
          H
        </text>
        <text
          x="360"
          y="174"
          textAnchor="middle"
          fill="white"
          fontSize="9"
          fontFamily="'Fraunces', Georgia, serif"
        >
          H
        </text>

        {/* Checkmark */}
        <path
          d="M385 165 L390 172 L400 158"
          fill="none"
          stroke="#1A7FA8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Label */}
        <text
          x="350"
          y="200"
          textAnchor="middle"
          fill="#1A7FA8"
          fontSize="12"
          fontFamily="sans-serif"
        >
          {"H\u2082 passes through"}
        </text>
      </g>

      {/* --- Caption --- */}
      <text
        x="250"
        y="238"
        textAnchor="middle"
        fill="#6B7280"
        fontSize="13"
        fontFamily="sans-serif"
      >
        {"Most antioxidants are stopped at the cell wall. H\u2082 reaches mitochondria and even the brain."}
      </text>
    </svg>
  );
}
