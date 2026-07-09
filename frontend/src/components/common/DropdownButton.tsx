import React from "react";
import Button from "./Button";
import { ICONS } from "../../utils/icons";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DropdownItem {
  label: string;
  /** Lucide icon component. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Absolute or relative image src — rendered as a real <img> instead of an SVG icon. */
  imgSrc?: string;
  /** Optional short description shown beneath the label. */
  description?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}

export type DropdownEntry = DropdownItem | { separator: true };

type ButtonVariant =
  | "primary"
  | "auth"
  | "outline"
  | "danger-outline"
  | "danger-inverse"
  | "success"
  | "ghost"
  | "icon"
  | "nav";

export interface DropdownButtonProps {
  label: string;
  items: DropdownEntry[];
  variant?: ButtonVariant;
  icon?: React.ComponentType<{ className?: string }>;
  align?: "left" | "right";
  direction?: "up" | "down";
  disabled?: boolean;
  className?: string;
  id?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSeparator(e: DropdownEntry): e is { separator: true } {
  return "separator" in e && (e as { separator: boolean }).separator === true;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * DropdownButton — a labeled button with a chevron that opens a styled flyout.
 *
 * Supports `imgSrc` on items to display real image icons (e.g. PDF/Excel assets).
 *
 * ```tsx
 * import pdfIcon  from "../../assets/icons8-export-pdf-50.png";
 * import xlsxIcon from "../../assets/icons8-export-excel-50.png";
 *
 * <DropdownButton
 *   label="Export"
 *   icon={ICONS.download}
 *   variant="ghost"
 *   direction="up"
 *   items={[
 *     { label: "Export as PDF",   imgSrc: pdfIcon,  onClick: () => handleExport("pdf") },
 *     { label: "Export as Excel", imgSrc: xlsxIcon, onClick: () => handleExport("xlsx") },
 *   ]}
 * />
 * ```
 */
export default function DropdownButton({
  label,
  items,
  variant = "primary",
  icon: LeadIcon,
  align = "left",
  direction = "down",
  disabled = false,
  className = "",
  id,
}: DropdownButtonProps) {
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
      containerRef.current?.querySelectorAll<HTMLButtonElement>("[data-dropdown-item]:not(:disabled)") ?? []
    );
    if (!btns.length) return;
    const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") { e.preventDefault(); btns[(idx + 1) % btns.length].focus(); }
    if (e.key === "ArrowUp")   { e.preventDefault(); btns[(idx - 1 + btns.length) % btns.length].focus(); }
  };

  // ── Panel positioning ──────────────────────────────────────────────────────
  const panelPositionCls = direction === "up" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]";
  const panelAlignCls = align === "right" ? "right-0" : "left-0";
  const entranceAnimation = direction === "up"
    ? "animate-in fade-in zoom-in-95 duration-150 origin-bottom-left"
    : "animate-in fade-in zoom-in-95 duration-150 origin-top-left";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`}>

      {/* ── Trigger ── */}
      <Button
        ref={triggerRef}
        id={id}
        variant={variant}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((p) => !p)}
        className="gap-2"
      >
        {LeadIcon && <LeadIcon className="w-4 h-4" />}
        <span>{label}</span>
        <ICONS.chevronDown
          className={`w-3.5 h-3.5 ml-0.5 opacity-70 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </Button>

      {/* ── Panel ── */}
      {open && (
        <div
          id={panelId}
          role="menu"
          aria-labelledby={id}
          onKeyDown={handlePanelKey}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "linear-gradient(160deg, #ffffff 0%, #f6f9fd 100%)",
            boxShadow: "0 12px 40px rgba(21,58,99,0.15), 0 3px 10px rgba(21,58,99,0.08)",
          }}
          className={[
            "absolute z-[60]",
            panelPositionCls,
            panelAlignCls,
            "rounded-2xl overflow-hidden",
            "min-w-[200px] py-1.5",
            entranceAnimation,
          ].join(" ")}
        >
          {items.map((entry, idx) => {
            if (isSeparator(entry)) {
              return (
                <div
                  key={`sep-${idx}`}
                  className="mx-3 my-1.5 h-px"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(21,58,99,0.10), transparent)" }}
                />
              );
            }

            const isDanger = entry.variant === "danger";
            const Icon = entry.icon;
            const hasDesc = Boolean(entry.description);

            return (
              <button
                key={entry.label}
                data-dropdown-item
                role="menuitem"
                disabled={entry.disabled}
                onClick={() => { setOpen(false); entry.onClick(); }}
                className={[
                  "group flex items-center gap-3 w-full text-left",
                  "mx-1 w-[calc(100%-8px)] rounded-xl",
                  "px-3 py-2.5",
                  "transition-all duration-120",
                  "focus:outline-none",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  isDanger
                    ? "hover:bg-red-50/80"
                    : "hover:bg-[#edf4fe]",
                ].join(" ")}
              >
                {/* Real image icon (e.g. PDF/Excel assets) */}
                {entry.imgSrc ? (
                  <img
                    src={entry.imgSrc}
                    alt=""
                    aria-hidden="true"
                    className="w-8 h-8 flex-shrink-0 object-contain drop-shadow-sm"
                  />
                ) : Icon ? (
                  /* Lucide icon in a chip */
                  <span className={[
                    "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl",
                    isDanger
                      ? "bg-red-50 text-red-400 group-hover:bg-red-100"
                      : "bg-sky-page/80 text-ink-icon group-hover:bg-ursb/10 group-hover:text-ursb",
                    "transition-colors duration-120",
                  ].join(" ")}>
                    <Icon className="w-4 h-4" />
                  </span>
                ) : null}

                {/* Label + optional description */}
                <div className="flex flex-col min-w-0">
                  <span className={[
                    "text-sm font-semibold leading-tight truncate",
                    isDanger
                      ? "text-red-500 group-hover:text-red-600"
                      : "text-ink group-hover:text-ursb",
                  ].join(" ")}>
                    {entry.label}
                  </span>
                  {hasDesc && (
                    <span className="text-[11px] text-ink-dim/70 leading-tight mt-0.5 truncate">
                      {entry.description}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
