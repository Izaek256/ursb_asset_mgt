import React from "react";

type Props = {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
};

export default function StatCard({ label, value, icon, color = "#185FA5" }: Props) {
  const cardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const iconEl = el.querySelector<HTMLElement>(".dash-stat-icon");
    if (iconEl && color) {
      iconEl.style.background = color + "20";
      iconEl.style.color = color;
    }
  }, [color]);

  return (
    <div className="dash-stat-card" ref={cardRef}>
      {icon && <div className="dash-stat-icon">{icon}</div>}
      <div>
        <div className="dash-stat-label">{label}</div>
        <div className="dash-stat-value">{typeof value === "number" ? value.toLocaleString() : value}</div>
      </div>
    </div>
  );
}
