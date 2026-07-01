import React from "react";

type BaseProps = {
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  className?: string;
};

type TextInputProps = BaseProps & {
  type: "text" | "email" | "password" | "number" | "date";
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

type SelectProps = BaseProps & {
  type: "select";
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
};

type TextareaProps = BaseProps & {
  type: "textarea";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  characterCount?: { current: number; min?: number };
};

type CheckboxProps = BaseProps & {
  type: "checkbox";
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

type Props = TextInputProps | SelectProps | TextareaProps | CheckboxProps;

export default function FormInput(props: Props) {
  const baseId = React.useId();
  const errorId = `${baseId}-error`;
  const helperId = `${baseId}-helper`;

  const hasError = "error" in props && !!props.error;

  const renderInput = () => {
    switch (props.type) {
      case "select":
        return (
          <select
            id={baseId}
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            disabled={props.disabled}
            className={`form-control ${hasError ? "form-control-error" : ""}`}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : helperId}
          >
            {props.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case "textarea":
        return (
          <>
            <textarea
              id={baseId}
              value={props.value}
              onChange={(e) => props.onChange(e.target.value)}
              placeholder={props.placeholder}
              rows={props.rows || 4}
              disabled={props.disabled}
              className={`form-control ${hasError ? "form-control-error" : ""}`}
              aria-invalid={hasError}
              aria-describedby={hasError ? errorId : helperId}
            />
            {props.characterCount && (
              <div className="form-char-counter">
                {props.characterCount.current}
                {props.characterCount.min && ` / ${props.characterCount.min} minimum`}
              </div>
            )}
          </>
        );

      case "checkbox":
        return (
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={props.checked}
              onChange={(e) => props.onChange(e.target.checked)}
              disabled={props.disabled}
            />
            <span className="toggle-slider"></span>
          </label>
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
            className={`form-control ${hasError ? "form-control-error" : ""}`}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : helperId}
          />
        );
    }
  };

  return (
    <div className={`form-group ${props.className || ""}`}>
      {props.label && (
        <label htmlFor={baseId} className="form-label">
          {props.label}
          {props.required && <span className="form-required">*</span>}
        </label>
      )}
      {renderInput()}
      {props.helper && !hasError && (
        <small id={helperId} className="form-helper">
          {props.helper}
        </small>
      )}
      {hasError && (
        <small id={errorId} className="form-error">
          {props.error}
        </small>
      )}
    </div>
  );
}
