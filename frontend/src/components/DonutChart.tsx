/**
 * DonutChart — segmented SVG donut with smooth clockwise sweep animation,
 * GPU-accelerated hover pop, glow, and a clean legend.
 *
 * Animation strategy:
 *  • Clockwise sweep uses strokeDashoffset on per-segment stroked arcs.
 *    Browsers animate strokeDashoffset natively on the GPU — no jank.
 *  • Hover pop uses CSS `scale()` transform, also GPU-accelerated.
 *    We never mutate path geometry on hover (that's what caused the glitch).
 *  • Data changes fade-swap: progress animates 0→1 with an ease-out cubic
 *    driven by requestAnimationFrame, but we cancel cleanly on unmount/change.
 */

import React from "react";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: DonutSlice[];
  size?: number;      // outer diameter, default 180
  thickness?: number; // ring thickness, default 34
  centerLabel?: string;
  centerSub?: string;
}

// Distinct accessible palette — ignores whatever color the API sends
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

/** Ease-out cubic — fast start, gentle settle */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function DonutChart({
  slices,
  size = 180,
  thickness = 34,
  centerLabel,
  centerSub,
}: Props) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [animProgress, setAnimProgress] = React.useState(0);

  // Assign palette colors
  const colored = slices.map((s, i) => ({
    ...s,
    color: PALETTE[i % PALETTE.length],
  }));

  // ── Clockwise sweep animation ──────────────────────────────────────────────
  // Reset and re-run whenever the slice data changes.
  const slicesKey = slices.map((s) => `${s.label}:${s.value}`).join("|");
  React.useEffect(() => {
    setAnimProgress(0);
    let raf: number;
    let start: number | null = null;
    const DURATION = 900; // ms — longer = more satisfying sweep

    function frame(ts: number) {
      if (start === null) start = ts;
      const raw = Math.min((ts - start) / DURATION, 1);
      setAnimProgress(easeOutCubic(raw));
      if (raw < 1) raf = requestAnimationFrame(frame);
    }

    // Defer one frame so React has painted the 0-state first (prevents flash)
    raf = requestAnimationFrame((ts) => {
      start = ts;
      raf = requestAnimationFrame(frame);
    });

    return () => cancelAnimationFrame(raf);
  }, [slicesKey]);

  // ── Geometry ───────────────────────────────────────────────────────────────
  const cx = size / 2;
  const cy = size / 2;
  const outerR = cx - 6;
  const innerR = outerR - thickness;
  const midR = (outerR + innerR) / 2; // radius of the stroke centre-line
  const circumference = 2 * Math.PI * midR;

  const total = colored.reduce((s, d) => s + d.value, 0) || 1;
  const GAP_DEG = colored.length > 1 ? 2.5 : 0;

  // Build per-segment data
  let cursor = -90; // start at 12 o'clock (SVG 0° is 3 o'clock)
  const segments = colored.map((s) => {
    const fullDeg = (s.value / total) * 360;
    const drawDeg = Math.max(fullDeg - GAP_DEG, 0.5);
    const rotateDeg = cursor + GAP_DEG / 2; // rotation of this segment's start
    cursor += fullDeg;

    // strokeDasharray/offset values for this segment
    const segLen = (drawDeg / 360) * circumference;
    return { ...s, drawDeg, rotateDeg, segLen };
  });

  // ── Center label (updates on hover) ───────────────────────────────────────
  const displayLabel =
    hovered !== null ? colored[hovered]?.label : centerLabel;
  const displaySub =
    hovered !== null
      ? `${colored[hovered]?.value.toLocaleString()} (${Math.round(
          (colored[hovered]?.value / total) * 100
        )}%)`
      : centerSub;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* ── Donut SVG ───────────────────────────────────────────────────── */}
      <div style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ overflow: "visible", display: "block" }}
        >
          {/* Background track ring */}
          <circle
            cx={cx}
            cy={cy}
            r={midR}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={thickness}
          />

          {segments.map((seg, i) => {
            if (seg.segLen < 0.5) return null;

            const isHov = hovered === i;

            // Clockwise reveal: dash that equals the full segment length,
            // then offset it so at animProgress=0 nothing shows,
            // at animProgress=1 the full segment is visible.
            const visibleLen = seg.segLen * animProgress;
            const dashArray = `${visibleLen} ${circumference - visibleLen}`;

            return (
              <g
                key={`${slicesKey}-${i}`}
                // transform-origin must be the SVG centre for scale to work
                style={{
                  transformOrigin: `${cx}px ${cy}px`,
                  transform: isHov ? "scale(1.07)" : "scale(1)",
                  // `transform` and `filter` are GPU-composited — no layout thrash
                  transition:
                    "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.18s ease",
                  filter: isHov
                    ? `drop-shadow(0 0 7px ${seg.color}99)`
                    : "none",
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={midR}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeDasharray={dashArray}
                  // rotate so the segment starts at the right position;
                  // -90 offset already baked into rotateDeg
                  strokeDashoffset={0}
                  transform={`rotate(${seg.rotateDeg} ${cx} ${cy})`}
                  strokeLinecap="butt"
                />
              </g>
            );
          })}

          {/* Center text */}
          {displayLabel && (
            <text
              x={cx}
              y={displaySub ? cy - 9 : cy + 5}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={displayLabel.length > 12 ? 9.5 : 11}
              fontWeight="700"
              fill="#1e293b"
              fontFamily="system-ui, -apple-system, sans-serif"
              style={{ pointerEvents: "none", transition: "all 0.2s ease" }}
            >
              {displayLabel}
            </text>
          )}
          {displaySub && (
            <text
              x={cx}
              y={cy + 10}
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

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="w-full flex flex-col gap-1">
        {segments.map((seg, i) => {
          const pct = Math.round((seg.value / total) * 100);
          const isHov = hovered === i;
          return (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer select-none"
              style={{
                background: isHov ? `${seg.color}18` : "transparent",
                transition: "background 0.18s ease",
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
                  transition: "box-shadow 0.18s ease",
                }}
              />
              {/* Label */}
              <span
                className="text-[11px] flex-1 truncate font-medium"
                style={{
                  color: isHov ? seg.color : "#374151",
                  transition: "color 0.18s ease",
                }}
                title={seg.label}
              >
                {seg.label}
              </span>
              {/* Count */}
              <span
                className="text-[10px] font-semibold tabular-nums shrink-0"
                style={{ color: "#9ca3af" }}
              >
                {seg.value.toLocaleString()}
              </span>
              {/* Percentage */}
              <span
                className="text-[11px] font-bold tabular-nums shrink-0 w-8 text-right"
                style={{
                  color: isHov ? seg.color : "#6b7280",
                  transition: "color 0.18s ease",
                }}
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
