import React from "react";
import { ICONS } from "../utils/icons";

type Props = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
};

const DefaultIcon = ICONS.assets;

export default function EmptyState({ icon, title, description }: Props) {
  const renderedIcon =
    icon ??
    React.createElement(DefaultIcon, { className: "w-6 h-6 text-ink-icon stroke-[2.2]" });

  return (
    <div className="bg-white border border-sky-cardBorder rounded-2xl p-12 text-center flex flex-col items-center gap-3 shadow-sm">
      <span className="w-14 h-14 rounded-2xl bg-sky-topbar border border-sky-border/30 flex items-center justify-center select-none">
        {renderedIcon}
      </span>
      <h3 className="font-bold text-ink text-base">{title}</h3>
      {description && (
        <p className="text-sm text-ink-dim max-w-sm leading-relaxed">{description}</p>
      )}
    </div>
  );
}
