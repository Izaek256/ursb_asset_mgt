import React from "react";
import { Listbox, Transition } from "@headlessui/react";
import { ICONS } from "../../utils/icons";
import Button from "./Button";

type BaseProps = {
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  className?: string;
  variant?: "dark" | "light";
};

type TextInputProps = BaseProps & {
  type: "text" | "email" | "password" | "number" | "date";
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
};

type SelectProps = BaseProps & {
  type: "select";
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
};

type TextareaProps = BaseProps & {
  type: "textarea";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  characterCount?: { current: number; min: number };
};

type Props = TextInputProps | SelectProps | TextareaProps;

export default function FormInput(props: Props) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const baseId = React.useId();
  const errorId = `${baseId}-error`;
  const helperId = `${baseId}-helper`;

  const hasError = !!props.error;
  const isLight = props.variant === "light";

  const labelStyles = isLight
    ? "text-xs font-bold text-ink-dim tracking-wider uppercase select-none mb-1.5"
    : "text-xs font-semibold text-white/70 tracking-wide uppercase select-none";

  const helperStyles = isLight ? "text-xs text-ink-dim/60 px-1" : "text-xs text-white/50 px-1";
  const errorStyles = "text-xs text-badge-roseText px-1 font-semibold";

  const inputStyles = isLight
    ? `w-full rounded-[9px] bg-white border ${
        hasError ? "border-badge-roseText" : "border-sky-cardBorder"
      } py-2.5 px-3.5 text-sm text-ink placeholder-ink-dim/40 focus:outline-none focus:bg-white focus:border-ursb focus:ring-[3px] focus:ring-ursb/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`
    : `w-full rounded-[9px] bg-navy-deep/30 border ${
        hasError ? "border-red-500/50" : "border-glass-border/38"
      } py-3 px-4 text-white placeholder-white/30 focus:outline-none focus:bg-navy-deep/45 focus:border-ice focus:ring-[3px] focus:ring-ursb/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`;

  const renderInput = () => {
    switch (props.type) {
      case "select":
        const isSearchable = (props as SelectProps).searchable;
        const filteredOptions = isSearchable
          ? props.options.filter((opt) =>
              opt.label.toLowerCase().includes(searchQuery.toLowerCase())
            )
          : props.options;

        return (
          <Listbox
            value={props.value}
            onChange={(val) => {
              props.onChange(val);
              setSearchQuery("");
            }}
            disabled={props.disabled}
          >
            <div className="relative w-full">
              <Listbox.Button
                className={`relative w-full text-left rounded-[9px] ${
                  isLight
                    ? "bg-white border border-sky-cardBorder py-2.5 pl-3.5 pr-10 text-sm text-ink"
                    : "bg-navy-deep/30 border border-glass-border/38 py-3 pl-4 pr-10 text-white placeholder-white/30"
                } focus:outline-none focus:ring-[3px] focus:ring-ursb/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                  isLight ? "focus:border-ursb focus:bg-white" : "focus:bg-navy-deep/45 focus:border-ice"
                }`}
              >
                <span className="block truncate">
                  {props.options.find((opt) => opt.value === props.value)?.label ||
                    props.placeholder ||
                    "Select an option"}
                </span>
                <span className={`absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none ${
                  isLight ? "text-ink-dim/60" : "text-white/50"
                }`}>
                  <ICONS.chevronDown className="w-4.5 h-4.5" aria-hidden="true" />
                </span>
              </Listbox.Button>
              <Transition
                as={React.Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options
                  className={`absolute z-50 w-full py-1 mt-1 overflow-auto text-base rounded-[9px] shadow-lg max-h-60 ring-1 ring-black/5 focus:outline-none ${
                    isLight
                      ? "bg-white border border-sky-cardBorder"
                      : "bg-navy-deep/95 border border-glass-border/38"
                  }`}
                >
                  {isSearchable && (
                    <div className="px-3 py-2 sticky top-0 bg-inherit z-10">
                      <input
                        type="text"
                        placeholder="Type to filter..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-full rounded-[6px] px-2.5 py-1.5 text-sm outline-none ${
                          isLight
                            ? "bg-sky-page border border-sky-cardBorder text-ink placeholder-ink-dim/40 focus:border-ursb"
                            : "bg-navy-deep/50 border border-glass-border/38 text-white placeholder-white/30 focus:border-ice"
                        }`}
                      />
                    </div>
                  )}
                  {filteredOptions.length === 0 ? (
                    <div className={`py-4 text-center text-sm ${isLight ? "text-ink-dim/60" : "text-white/50"}`}>
                      No results found
                    </div>
                  ) : (
                    filteredOptions.map((opt) => (
                      <Listbox.Option
                        key={opt.value}
                        value={opt.value}
                        className={({ active }) =>
                          `relative cursor-pointer select-none py-2.5 pl-10 pr-4 text-sm ${
                            active
                              ? isLight
                                ? "bg-sky-page text-ursb-dark"
                                : "bg-ursb text-white"
                              : isLight
                              ? "text-ink"
                              : "text-ice"
                          }`
                        }
                      >
                        {({ selected, active }) => (
                          <>
                            <span
                              className={`block truncate ${
                                selected ? "font-bold" : "font-normal"
                              }`}
                            >
                              {opt.label}
                            </span>
                            {selected ? (
                              <span
                                className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                  active
                                    ? isLight
                                      ? "text-ursb-dark"
                                      : "text-white"
                                    : "text-ursb"
                                }`}
                              >
                                <ICONS.checkCircle
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                />
                              </span>
                            ) : null}
                          </>
                        )}
                      </Listbox.Option>
                    ))
                  )}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
        );

      case "password":
        return (
          <div className="relative w-full">
            <input
              id={baseId}
              type={showPassword ? "text" : "password"}
              value={props.value}
              onChange={(e) => props.onChange(e.target.value)}
              placeholder={props.placeholder}
              disabled={props.disabled}
              className={`${inputStyles} pr-12`}
              aria-invalid={hasError}
              aria-describedby={hasError ? errorId : helperId}
              autoComplete={props.autoComplete || "current-password"}
            />
            <Button
              type="button"
              variant="icon"
              className={`absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 border-none bg-transparent shadow-none hover:shadow-none ${
                isLight ? "text-ink-dim/50 hover:text-ink" : "text-white/40 hover:text-white/80"
              }`}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <ICONS.eyeOff className="w-4 h-4 stroke-[2.2]" />
              ) : (
                <ICONS.eye className="w-4 h-4 stroke-[2.2]" />
              )}
            </Button>
          </div>
        );

      case "textarea":
        return (
          <div className="flex flex-col gap-1 w-full">
            <textarea
              id={baseId}
              value={props.value}
              onChange={(e) => props.onChange(e.target.value)}
              placeholder={props.placeholder}
              disabled={props.disabled}
              rows={props.rows || 3}
              className={`${inputStyles} resize-none`}
              aria-invalid={hasError}
              aria-describedby={hasError ? errorId : helperId}
            />
            {props.characterCount && (
              <span className={`text-[10px] self-end font-bold select-none mt-0.5 ${
                props.characterCount.current >= props.characterCount.min
                  ? "text-badge-greenText"
                  : "text-ink-dim/50"
              }`}>
                {props.characterCount.current} / {props.characterCount.min} min chars
              </span>
            )}
          </div>
        );

      default:
        return (
          <input
            id={baseId}
            type={props.type}
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder={props.placeholder}
            disabled={props.disabled}
            autoFocus={props.autoFocus}
            className={inputStyles}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : helperId}
            autoComplete={props.autoComplete}
          />
        );
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 w-full ${props.className || ""}`}>
      {props.label && (
        <label htmlFor={baseId} className={labelStyles}>
          {props.label}
          {props.required && <span className="text-badge-roseText ml-1">*</span>}
        </label>
      )}
      {renderInput()}
      {props.helper && !hasError && (
        <span id={helperId} className={helperStyles}>
          {props.helper}
        </span>
      )}
      {hasError && (
        <span id={errorId} className={errorStyles}>
          {props.error}
        </span>
      )}
    </div>
  );
}
