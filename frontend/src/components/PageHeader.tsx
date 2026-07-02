import React from "react";

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="page-header-actions-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--color-primary)" }}>{title}</h2>
        {subtitle && <p className="text-small text-muted" style={{ marginTop: "0.25rem" }}>{subtitle}</p>}
      </div>
      {actions && <div className="page-header-buttons" style={{ display: "flex", gap: "0.5rem" }}>{actions}</div>}
    </div>
  );
}
