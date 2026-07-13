import React from "react";

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-1">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-ink leading-tight">{title}</h2>
        {subtitle && (
          <p className="text-sm text-ink-dim mt-1.5 font-medium">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
