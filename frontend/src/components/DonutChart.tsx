/**
 * DonutChart — segmented SVG donut with visible gaps, entry animation,
 * hover pop, glow, and a clean legend. No external dependencies.
 */

import React from "react";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: DonutSlice[];
  size?: number;       // outer diameter, default 180
  thickness?: number;  // ring thickness, default 34
  centerLabel?: string;
  centerSub?: string;
}

// Strong distinct palette — overrides whatever color the API sends if needed
const PALETTE = [
  "#2563eb", // blue
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#ec4899", // pink
  "#0d9488", // teal
  "#f97316", // orange
];

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Build an SVG filled arc path (a "pie wedge" clipped to a donut ring). */
function arcPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number
): string {
  const sweep = Math.min(endDeg - startDeg, 359.99);
  const large = sweep > 180 ? 1 : 0;

  const o1 = polar(cx, cy, outerR, startDeg);
  const o2 = polar(cx, cy, outerR, startDeg + sweep);
  const i1 = polar(cx, cy, innerR, startDeg + sweep);
  const i2 = polar(cx, cy, innerR, startDeg);

  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i2.x} ${i2.y}`,
    "Z",
  ].join(" ");
}

export default function DonutChart({
  slices,
  size = 180,
  thickness = 34,
  centerLabel,
  centerSub,
}: Props) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [animProgress, setAnimProgress] = React.useState(0);

  // Assign guaranteed-distinct colors from palette, override API colors
  const colored = slices.map((s, i) => ({
    ...s,
    color: PALETTE[i % PALETTE.length],
  }));

  // Sweep-in animation on mount and when data changes
  const slicesKey = slices.map(s => `${s.label}:${s.value}`).join("|");
  React.useEffect(() => {
    setAnimProgress(0);
    let raf: number;
    let start: number | null = null;
    const duration = 700;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // ease-out cubic

    function frame(ts: number) {
      if (!start) start = ts;
      const t = Math.min((ts - start) / duration, 1);
      setAnimProgress(ease(t));
      if (t < 1) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [slicesKey]);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = cx - 6;
  const innerR = outerR - thickness;

  const total = colored.reduce((s, d) => s + d.value, 0) || 1;

  // Gap between segments in degrees
  const GAP_DEG = colored.length > 1 ? 2.5 : 0;

  // Build segment data
  let cursor = 0;
  const segments = colored.map((s) => {
    const fullDeg = (s.value / total) * 360;
    const drawDeg = Math.max(fullDeg - GAP_DEG, 0.5);
    const start   = cursor + GAP_DEG / 2;
    cursor += fullDeg;
    return { ...s, start, drawDeg };
  });

  const displayLabel = hovered !== null ? colored[hovered]?.label : centerLabel;
  const displaySub =
    hovered !== null
      ? `${colored[hovered]?.value.toLocaleString()} (${Math.round((colored[hovered]?.value / total) * 100)}%)`
      : centerSub;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* ── Donut SVG ─────────────────────────────────────────────────────── */}
      <div style={{ width: size, height: size, position: "relative" }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ overflow: "visible", display: "block" }}
        >
          {/* Track ring */}
          <circle
            cx={cx} cy={cy} r={(outerR + innerR) / 2}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={thickness}
          />

          {segments.map((seg, i) => {
            if (seg.drawDeg < 0.1) return null;

            const isHov      = hovered === i;
            const animDeg    = seg.drawDeg * animProgress;
            const hovOuterR  = isHov ? outerR + 6 : outerR;
            const hovInnerR  = isHov ? innerR - 3 : innerR;

            const d = arcPath(cx, cy, hovOuterR, hovInnerR, seg.start, seg.start + animDeg);

            return (
              <g key={`${slicesKey}-${i}`}>
                {/* Glow behind hovered segment */}
                {isHov && (
                  <path
                    d={arcPath(cx, cy, outerR + 10, innerR - 6, seg.start, seg.start + animDeg)}
                    fill={seg.color}
                    opacity={0.18}
                    style={{ transition: "opacity 0.15s" }}
                  />
                )}
                <path
                  d={d}
                  fill={seg.color}
                  style={{
                    cursor: "pointer",
                    transition: "d 0.15s cubic-bezier(.4,0,.2,1), filter 0.15s",
                    filter: isHov
                      ? `drop-shadow(0 2px 8px ${seg.color}99)`
                      : "none",
                  }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
              </g>
            );
          })}

          {/* Center text */}
          {displayLabel && (
            <text
              x={cx} y={displaySub ? cy - 9 : cy + 5}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={displayLabel.length > 12 ? 9.5 : 11}
              fontWeight="700"
              fill="#1e293b"
              fontFamily="system-ui, -apple-system, sans-serif"
              style={{ pointerEvents: "none", transition: "all 0.15s" }}
            >
              {displayLabel}
            </text>
          )}
          {displaySub && (
            <text
              x={cx} y={cy + 10}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fontWeight="500"
              fill="#64748b"
              fontFamily="system-ui, -apple-system, sans-serif"
              style={{ pointerEvents: "none" }}
            >
              {displaySub}
            </text>
          )}
        </svg>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="w-full flex flex-col gap-1">
        {segments.map((seg, i) => {
          const pct   = Math.round((seg.value / total) * 100);
          const isHov = hovered === i;
          return (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer select-none"
              style={{
                background: isHov ? `${seg.color}18` : "transparent",
                transition: "background 0.15s",
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Color swatch */}
              <span
                className="shrink-0 rounded-sm"
                style={{
                  width: 10,
                  height: 10,
                  background: seg.color,
                  boxShadow: isHov ? `0 0 0 2px ${seg.color}55` : "none",
                  transition: "box-shadow 0.15s",
                }}
              />
              {/* Label */}
              <span
                className="text-[11px] flex-1 truncate font-medium"
                style={{ color: isHov ? seg.color : "#374151" }}
                title={seg.label}
              >
                {seg.label}
              </span>
              {/* Count + pct */}
              <span className="text-[10px] font-semibold tabular-nums shrink-0" style={{ color: "#9ca3af" }}>
                {seg.value.toLocaleString()}
              </span>
              <span
                className="text-[11px] font-bold tabular-nums shrink-0 w-8 text-right"
                style={{ color: isHov ? seg.color : "#6b7280" }}
              >
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
