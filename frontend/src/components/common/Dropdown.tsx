/**
 * Dropdown — compound component namespace.
 *
 * Built on @headlessui/react v2 `Menu` primitives.
 * No borders. No outlines. No separators. Pure depth and motion.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 * import { Dropdown } from "@/components/common/Dropdown";
 * import { ICONS }    from "@/utils/icons";
 *
 * <Dropdown.Root>
 *   <Dropdown.Trigger icon={ICONS.download} label="Export" />
 *
 *   <Dropdown.Panel align="left" direction="up">
 *     <Dropdown.Section>
 *       <Dropdown.Item imgSrc={pdfIcon}  label="Export as PDF"   description="Print-ready report" onClick={...} />
 *       <Dropdown.Item imgSrc={xlsxIcon} label="Export as Excel" description="Editable spreadsheet" onClick={...} />
 *     </Dropdown.Section>
 *   </Dropdown.Panel>
 * </Dropdown.Root>
 *
 * ─── Props ────────────────────────────────────────────────────────────────────
 *
 * Dropdown.Root    — no props (wraps Headless UI <Menu>)
 * Dropdown.Trigger — label, icon?, variant?, disabled?
 * Dropdown.Panel   — align? "left"|"right"  direction? "up"|"down"  className?
 * Dropdown.Section — children (groups items with optional heading)
 * Dropdown.Item    — label, onClick, icon?, imgSrc?, description?, disabled?, variant? "default"|"danger"
 *
 * ─── Dependencies already installed ─────────────────────────────────────────
 *   @headlessui/react  ^2.2  (already in package.json)
 *   tailwindcss        ^3.4  (already in package.json)
 *   lucide-react       ^1.23 (already in package.json)
 */

import React from "react";
import {
  Menu,
  MenuButton,
  MenuItems,
  MenuItem,
  Transition,
} from "@headlessui/react";
import Button from "./Button";
import { ICONS } from "../../utils/icons";

// ─── Types ────────────────────────────────────────────────────────────────────

type ButtonVariant =
  | "primary" | "auth" | "outline" | "danger-outline"
  | "danger-inverse" | "success" | "ghost" | "icon" | "nav";

interface TriggerProps {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Show rotating chevron — set false for icon-only triggers. */
  chevron?: boolean;
  className?: string;
}

interface PanelProps {
  children: React.ReactNode;
  align?: "left" | "right";
  direction?: "up" | "down";
  className?: string;
  /** Min-width override e.g. "220px". Default 210px. */
  minWidth?: string;
}

interface SectionProps {
  children: React.ReactNode;
  heading?: string;
}

interface ItemProps {
  label: string;
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  /** Real image asset src — overrides icon */
  imgSrc?: string;
  /** Subtitle shown beneath label */
  description?: string;
  disabled?: boolean;
  variant?: "default" | "danger";
  className?: string;
}

// ─── Panel (Popover) ──────────────────────────────────────────────────────────

function Panel({
  children,
  align = "left",
  direction = "down",
  className = "",
  minWidth = "210px",
}: PanelProps) {
  const positionCls =
    direction === "up"
      ? "bottom-[calc(100%+8px)]"
      : "top-[calc(100%+8px)]";
  const alignCls = align === "right" ? "right-0" : "left-0";
  const originCls =
    direction === "up"
      ? align === "right" ? "origin-bottom-right" : "origin-bottom-left"
      : align === "right" ? "origin-top-right"    : "origin-top-left";

  return (
    <Transition
      enter="transition duration-150 ease-out"
      enterFrom="opacity-0 scale-95"
      enterTo="opacity-100 scale-100"
      leave="transition duration-100 ease-in"
      leaveFrom="opacity-100 scale-100"
      leaveTo="opacity-0 scale-95"
    >
      <MenuItems
        anchor={false}
        style={{
          minWidth,
          background: "linear-gradient(150deg, #ffffff 0%, #f4f8fd 100%)",
          boxShadow:
            "0 12px 40px rgba(21,58,99,0.14), 0 3px 10px rgba(21,58,99,0.07), 0 0 0 0.5px rgba(21,58,99,0.06)",
        }}
        className={[
          "absolute z-[70] py-2 rounded-2xl overflow-hidden",
          "focus:outline-none",
          positionCls,
          alignCls,
          originCls,
          className,
        ].join(" ")}
      >
        {children}
      </MenuItems>
    </Transition>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ children, heading }: SectionProps) {
  return (
    <div className="px-1.5">
      {heading && (
        <p className="px-2 pt-1.5 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-ink-dim/50 select-none">
          {heading}
        </p>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

// ─── Item ─────────────────────────────────────────────────────────────────────

function Item({
  label,
  onClick,
  icon: Icon,
  imgSrc,
  description,
  disabled = false,
  variant = "default",
  className = "",
}: ItemProps) {
  const isDanger = variant === "danger";

  return (
    <MenuItem>
      {({ focus }) => (
        <button
          disabled={disabled}
          onClick={onClick}
          className={[
            "flex items-center gap-3 w-full text-left",
            "px-2.5 py-2.5 rounded-xl",
            "transition-all duration-100",
            "focus:outline-none",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            focus || !disabled
              ? isDanger
                ? focus ? "bg-red-50/90 text-red-600" : "text-red-500 hover:bg-red-50/80 hover:text-red-600"
                : focus ? "bg-[#e8f1fd] text-ursb" : "text-ink hover:bg-[#e8f1fd] hover:text-ursb"
              : "",
            className,
          ].join(" ")}
        >
          {/* Image asset (PDF / Excel etc) — priority over icon */}
          {imgSrc ? (
            <img
              src={imgSrc}
              alt=""
              aria-hidden="true"
              className="w-8 h-8 flex-shrink-0 object-contain drop-shadow-sm"
            />
          ) : Icon ? (
            <span
              className={[
                "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl transition-colors duration-100",
                isDanger
                  ? focus ? "bg-red-100 text-red-500" : "bg-red-50 text-red-400"
                  : focus ? "bg-ursb/10 text-ursb" : "bg-sky-page/80 text-ink-icon",
              ].join(" ")}
            >
              <Icon className="w-4 h-4" />
            </span>
          ) : null}

          {/* Text block */}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold leading-tight truncate">
              {label}
            </span>
            {description && (
              <span className="text-[11px] text-ink-dim/60 leading-tight mt-0.5 truncate">
                {description}
              </span>
            )}
          </div>
        </button>
      )}
    </MenuItem>
  );
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

function Trigger({
  label,
  icon: LeadIcon,
  variant = "primary",
  disabled = false,
  chevron = true,
  className = "",
}: TriggerProps) {
  return (
    <MenuButton as={React.Fragment}>
      {({ active }) => (
        <Button
          variant={variant}
          disabled={disabled}
          data-active={active || undefined}
          className={`gap-2 ${className}`}
        >
          {LeadIcon && <LeadIcon className="w-4 h-4" />}
          <span>{label}</span>
          {chevron && (
            <ICONS.chevronDown
              className={`w-3.5 h-3.5 ml-0.5 opacity-70 transition-transform duration-200 ${
                active ? "rotate-180" : ""
              }`}
            />
          )}
        </Button>
      )}
    </MenuButton>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function Root({ children }: { children: React.ReactNode }) {
  return (
    <Menu as="div" className="relative inline-flex">
      {children}
    </Menu>
  );
}

// ─── Namespace export ─────────────────────────────────────────────────────────

export const Dropdown = {
  Root,
  Trigger,
  Panel,
  Section,
  Item,
} as const;

export type {
  TriggerProps  as DropdownTriggerProps,
  PanelProps    as DropdownPanelProps,
  SectionProps  as DropdownSectionProps,
  ItemProps     as DropdownItemProps,
};
