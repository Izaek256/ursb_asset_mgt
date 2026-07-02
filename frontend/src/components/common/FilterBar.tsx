import React from "react";
import Button from "./Button";

export const filterInputCls =
  "w-full min-w-0 px-3 py-2.5 text-sm text-ink bg-sky-topbar border border-sky-cardBorder rounded-lg focus:outline-none focus:ring-2 focus:ring-ursb/20 focus:border-ursb placeholder:text-ink-dim/50 transition-colors motion-reduce:transition-none";

export const filterSelectCls = filterInputCls;

interface FilterBarProps {
  children: React.ReactNode;
  trailing?: React.ReactNode;
  count?: { value: number; label: string };
  onClear?: () => void;
  className?: string;
}

export default function FilterBar({
  children,
  trailing,
  count,
  onClear,
  className = "",
}: FilterBarProps) {
  return (
    <div
      className={`flex flex-wrap items-end gap-4 sm:gap-6 p-4 sm:px-5 bg-white border border-sky-cardBorder rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-250 motion-reduce:transition-none ${className}`}
    >
      {children}
      {onClear && (
        <Button variant="outline" onClick={onClear}>
          Clear Filters
        </Button>
      )}
      {trailing}
      {count && (
        <span className="ml-auto text-sm font-semibold text-ink-dim self-center whitespace-nowrap">
          {count.value} {count.label}
        </span>
      )}
    </div>
  );
}

interface FilterFieldProps {
  label?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
  grow?: boolean;
}

export function FilterField({
  label,
  htmlFor,
  children,
  className = "",
  grow = false,
}: FilterFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${grow ? "flex-1 min-w-[180px]" : ""} ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-[10px] font-bold uppercase tracking-wider text-ink-dim select-none"
        >
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

/** @deprecated use count prop on FilterBar instead */
export function FilterCount({ count, label }: { count: number; label: string }) {
  return (
    <span className="ml-auto text-sm font-semibold text-ink-dim self-center whitespace-nowrap">
      {count} {label}
    </span>
  );
}
