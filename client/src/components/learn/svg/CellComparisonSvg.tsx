export default function CellComparisonSvg() {
  return (
    <svg
      viewBox="0 0 500 280"
      width="100%"
      height="auto"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* --- Left: Healthy cell --- */}
      <g>
        <circle
          cx="120"
          cy="120"
          r="80"
          fill="rgba(209,250,229,0.4)"
          stroke="#10B981"
          strokeWidth="1.5"
        />

        {/* Internal green dots */}
        <circle cx="100" cy="100" r="5" fill="#10B981" opacity="0.7" />
        <circle cx="130" cy="110" r="5" fill="#10B981" opacity="0.6" />
        <circle cx="115" cy="140" r="5" fill="#10B981" opacity="0.7" />
        <circle cx="140" cy="130" r="5" fill="#10B981" opacity="0.5" />

        {/* Shield icon (top-right of cell) */}
        <path
          d="M165 60 L175 65 L175 78 C175 86 170 92 165 95 C160 92 155 86 155 78 L155 65 Z"
          fill="#10B981"
          opacity="0.5"
          stroke="#10B981"
          strokeWidth="1"
        />

        {/* Label */}
        <text
          x="120"
          y="225"
          textAnchor="middle"
          fill="#059669"
          fontSize="13"
          fontFamily="sans-serif"
        >
          Healthy Cell
        </text>
      </g>

      {/* --- Arrow between cells --- */}
      <g>
        <line
          x1="220"
          y1="120"
          x2="270"
          y2="120"
          stroke="#6B7280"
          strokeWidth="1.5"
          markerEnd="url(#arrowGray)"
        />
        <defs>
          <marker
            id="arrowGray"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 Z" fill="#6B7280" />
          </marker>
        </defs>
        <text
          x="245"
          y="108"
          textAnchor="middle"
          fill="#6B7280"
          fontSize="12"
          fontFamily="sans-serif"
        >
          {"Free radicals \u2192"}
        </text>
      </g>

      {/* --- Right: Stressed cell --- */}
      <g>
        <circle
          cx="380"
          cy="120"
          r="80"
          fill="rgba(254,226,226,0.4)"
          stroke="#EF4444"
          strokeWidth="1.5"
        />

        {/* Internal dots (scattered) */}
        <circle cx="355" cy="95" r="5" fill="#EF4444" opacity="0.5" />
        <circle cx="400" cy="140" r="5" fill="#EF4444" opacity="0.4" />
        <circle cx="370" cy="150" r="5" fill="#EF4444" opacity="0.5" />

        {/* Lightning bolts around the cell */}
        <path
          d="M290 70 L295 80 L291 80 L296 92 L289 78 L293 78 Z"
          fill="#EF4444"
        />
        <path
          d="M460 85 L465 95 L461 95 L466 107 L459 93 L463 93 Z"
          fill="#EF4444"
        />
        <path
          d="M310 170 L315 180 L311 180 L316 192 L309 178 L313 178 Z"
          fill="#EF4444"
        />
        <path
          d="M450 155 L455 165 L451 165 L456 177 L449 163 L453 163 Z"
          fill="#EF4444"
        />
        <path
          d="M395 30 L400 40 L396 40 L401 52 L394 38 L398 38 Z"
          fill="#EF4444"
        />

        {/* Label */}
        <text
          x="380"
          y="225"
          textAnchor="middle"
          fill="#DC2626"
          fontSize="13"
          fontFamily="sans-serif"
        >
          Cell Under Oxidative Stress
        </text>
      </g>
    </svg>
  );
}
