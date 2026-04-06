export default function MoleculeComparisonSvg() {
  return (
    <svg
      viewBox="0 0 500 280"
      width="100%"
      height="auto"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* --- Left: H2O molecule --- */}
      <g>
        {/* Oxygen atom */}
        <circle
          cx="130"
          cy="110"
          r="50"
          fill="rgba(59,130,246,0.2)"
          stroke="#3B82F6"
          strokeWidth="1.5"
        />
        <text
          x="130"
          y="117"
          textAnchor="middle"
          fill="#3B82F6"
          fontSize="20"
          fontFamily="'Fraunces', Georgia, serif"
        >
          O
        </text>

        {/* Bond lines */}
        <line x1="95" y1="145" x2="75" y2="175" stroke="#60A5FA" strokeWidth="1.5" />
        <line x1="165" y1="145" x2="185" y2="175" stroke="#60A5FA" strokeWidth="1.5" />

        {/* Left hydrogen */}
        <circle
          cx="65"
          cy="190"
          r="28"
          fill="rgba(147,197,253,0.3)"
          stroke="#60A5FA"
          strokeWidth="1.5"
        />
        <text
          x="65"
          y="197"
          textAnchor="middle"
          fill="#60A5FA"
          fontSize="16"
          fontFamily="'Fraunces', Georgia, serif"
        >
          H
        </text>

        {/* Right hydrogen */}
        <circle
          cx="195"
          cy="190"
          r="28"
          fill="rgba(147,197,253,0.3)"
          stroke="#60A5FA"
          strokeWidth="1.5"
        />
        <text
          x="195"
          y="197"
          textAnchor="middle"
          fill="#60A5FA"
          fontSize="16"
          fontFamily="'Fraunces', Georgia, serif"
        >
          H
        </text>

        {/* Label */}
        <text
          x="130"
          y="248"
          textAnchor="middle"
          fill="#6B7280"
          fontSize="13"
          fontFamily="sans-serif"
        >
          {"Water (H\u2082O)"}
        </text>
      </g>

      {/* --- Vertical dashed divider --- */}
      <line
        x1="250"
        y1="30"
        x2="250"
        y2="260"
        stroke="#E2E8F0"
        strokeWidth="1.5"
        strokeDasharray="6 4"
      />

      {/* --- Right: H2 molecule --- */}
      <g>
        {/* Badge */}
        <rect
          x="290"
          y="28"
          width="180"
          height="24"
          rx="12"
          fill="#E3F2FA"
        />
        <text
          x="380"
          y="44"
          textAnchor="middle"
          fill="#1A7FA8"
          fontSize="11"
          fontFamily="sans-serif"
        >
          The one scientists are studying
        </text>

        {/* Left hydrogen */}
        <circle
          cx="340"
          cy="130"
          r="32"
          fill="rgba(26,127,168,0.15)"
          stroke="#1A7FA8"
          strokeWidth="1.5"
        />
        <text
          x="340"
          y="137"
          textAnchor="middle"
          fill="#1A7FA8"
          fontSize="18"
          fontFamily="'Fraunces', Georgia, serif"
        >
          H
        </text>

        {/* Double bond */}
        <line x1="372" y1="126" x2="408" y2="126" stroke="#1A7FA8" strokeWidth="1.5" />
        <line x1="372" y1="134" x2="408" y2="134" stroke="#1A7FA8" strokeWidth="1.5" />

        {/* Right hydrogen */}
        <circle
          cx="420"
          cy="130"
          r="32"
          fill="rgba(26,127,168,0.15)"
          stroke="#1A7FA8"
          strokeWidth="1.5"
        />
        <text
          x="420"
          y="137"
          textAnchor="middle"
          fill="#1A7FA8"
          fontSize="18"
          fontFamily="'Fraunces', Georgia, serif"
        >
          H
        </text>

        {/* Label */}
        <text
          x="380"
          y="248"
          textAnchor="middle"
          fill="#1A7FA8"
          fontSize="13"
          fontWeight="bold"
          fontFamily="sans-serif"
        >
          {"Molecular hydrogen (H\u2082)"}
        </text>
      </g>
    </svg>
  );
}
