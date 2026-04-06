export default function H2MoleculeSvg() {
  return (
    <svg
      viewBox="0 0 220 220"
      width="100%"
      height="auto"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g style={{ animation: "lp-float 4s ease-in-out infinite" }}>
        {/* Double bond lines */}
        <line
          x1="78"
          y1="86"
          x2="142"
          y2="86"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="2"
        />
        <line
          x1="78"
          y1="94"
          x2="142"
          y2="94"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="2"
        />

        {/* Left hydrogen atom */}
        <circle
          cx="65"
          cy="90"
          r="40"
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="1.5"
        />
        <text
          x="65"
          y="97"
          textAnchor="middle"
          fill="white"
          fontSize="18"
          fontFamily="'Fraunces', Georgia, serif"
        >
          H
        </text>

        {/* Right hydrogen atom */}
        <circle
          cx="155"
          cy="90"
          r="40"
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="1.5"
        />
        <text
          x="155"
          y="97"
          textAnchor="middle"
          fill="white"
          fontSize="18"
          fontFamily="'Fraunces', Georgia, serif"
        >
          H
        </text>
      </g>

      {/* Caption */}
      <text
        x="110"
        y="175"
        textAnchor="middle"
        fill="#8EC8E8"
        fontSize="13"
        fontFamily="sans-serif"
      >
        {"H\u2082 \u2014 molecular hydrogen"}
      </text>
    </svg>
  );
}
