import React from "react";
import { ICONS } from "../../utils/icons";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KebabMenuItem {
  label: string;
  /** Lucide icon component. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Absolute or relative image src — rendered as a real <img> instead of an SVG icon. */
  imgSrc?: string;
  onClick: () => void;
  disabled?: boolean;
  /** "danger" renders item in red; "default" is normal ink. */
  variant?: "default" | "danger";
}

export type KebabMenuEntry = KebabMenuItem | { separator: true };

export interface KebabMenuProps {
  items: KebabMenuEntry[];
  id?: string;
  /** Panel anchor side. Default "right". */
  align?: "left" | "right";
  disabled?: boolean;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSeparator(e: KebabMenuEntry): e is { separator: true } {
  return "separator" in e && (e as { separator: boolean }).separator === true;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * KebabMenu — the canonical three-dot context menu.
 *
 * All state (open/close, outside-click, Escape, arrow keys) is self-contained.
 *
 * ```tsx
 * <KebabMenu items={[
 *   { label: "Edit",   icon: ICONS.edit,       onClick: handleEdit },
 *   { label: "Delete", icon: ICONS.trashCircle, onClick: handleDelete, variant: "danger" },
 * ]} />
 * ```
 */
export default function KebabMenu({
  items,
  id,
  align = "right",
  disabled = false,
  className = "",
}: KebabMenuProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelId = id ? `${id}-panel` : undefined;

  // ── Outside-click & Escape ─────────────────────────────────────────────────
  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // ── Arrow key nav ──────────────────────────────────────────────────────────
  const handlePanelKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const btns = Array.from(
      containerRef.current?.querySelectorAll<HTMLButtonElement>("[data-kebab-item]:not(:disabled)") ?? []
    );
    if (!btns.length) return;
    const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") { e.preventDefault(); btns[(idx + 1) % btns.length].focus(); }
    if (e.key === "ArrowUp")   { e.preventDefault(); btns[(idx - 1 + btns.length) % btns.length].focus(); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`}>

      {/* ── Trigger ─────────────────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        id={id}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
        title="More actions"
        style={{
          border: "none",
          outline: "none",
        }}
        className={[
          "inline-flex items-center justify-center w-10 h-10 rounded-lg cursor-pointer",
          "transition-all duration-150 focus:outline-none",
          "!border-0 !outline-none",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          open
            ? "bg-ink/8 text-ink shadow-sm"
            : "text-ink-dim hover:text-ink hover:bg-ink/6",
        ].join(" ")}
      >
        <ICONS.kebab className="w-[18px] h-[18px] stroke-[2.5]" />
      </button>

      {/* ── Panel ───────────────────────────────────────────────────────────── */}
      {open && (
        <div
          id={panelId}
          role="menu"
          aria-labelledby={id}
          onKeyDown={handlePanelKey}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#ffffff",
            boxShadow: "none",
            border: "none",
            outline: "none",
          }}
          className={[
            "absolute top-[calc(100%+6px)] z-50",
            align === "right" ? "right-0" : "left-0",
            "!rounded-none !overflow-hidden",
            "!border-0 !outline-none",
            "min-w-[192px] py-1.5",
            "animate-in fade-in zoom-in-95 duration-150 origin-top-right",
          ].join(" ")}
        >
          {items.map((entry, idx) => {
            if (isSeparator(entry)) {
              return (
                <div
                  key={`sep-${idx}`}
                  className="mx-3 my-1.5 h-px"
                  style={{ background: "rgba(21,58,99,0.10)" }}
                />
              );
            }

            const isDanger = entry.variant === "danger";
            const Icon = entry.icon;

            return (
              <button
                key={entry.label}
                data-kebab-item
                role="menuitem"
                disabled={entry.disabled}
                onClick={() => { setOpen(false); entry.onClick(); }}
                style={{
                  border: "none",
                  outline: "none",
                }}
                className={[
                  "group flex items-center gap-3 w-full text-left",
                  "mx-1 w-[calc(100%-8px)] !rounded-none",
                  "px-3 py-2.5 text-sm font-medium",
                  "transition-none",
                  "focus:outline-none",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  "!border-0 !outline-none",
                  isDanger
                    ? "text-red-500"
                    : "text-ink",
                ].join(" ")}
              >
                {/* Image icon takes priority over Lucide icon */}
                {entry.imgSrc ? (
                  <img
                    src={entry.imgSrc}
                    alt=""
                    aria-hidden="true"
                    className="w-5 h-5 flex-shrink-0 object-contain"
                    style={{ border: "none", outline: "none" }}
                  />
                ) : Icon ? (
                  <span className={[
                    "flex-shrink-0 flex items-center justify-center w-7 h-7 !rounded-none",
                    isDanger
                      ? "bg-red-50 text-red-400"
                      : "bg-sky-page/70 text-ink-icon",
                    "transition-none",
                    "!border-0 !outline-none",
                  ].join(" ")} style={{ border: "none", outline: "none" }}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                ) : null}
                <span className="leading-tight">{entry.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
