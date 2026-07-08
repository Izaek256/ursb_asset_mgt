import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "auth" | "outline" | "danger-outline" | "danger-inverse" | "success" | "ghost" | "icon" | "nav";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  isLoading?: boolean;
  active?: boolean;
};

export default function Button({
  variant = "primary",
  size: _size,
  fullWidth = false,
  isLoading = false,
  active = false,
  children,
  className = "",
  disabled,
  // Destructure Headless UI internal render props so they don't land on the DOM element
  hover: _hover,
  focus: _focus,
  autofocus: _autofocus,
  ...props
}: ButtonProps & { hover?: boolean; focus?: boolean; autofocus?: boolean }) {
  const baseStyle =
    "flex items-center justify-center font-bold transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 motion-reduce:transform-none motion-reduce:transition-none cursor-pointer select-none whitespace-nowrap";

  const variants = {
    auth:
      "rounded-xl py-3 px-5 text-sm bg-gradient-to-br from-ursb to-ursb-dark text-white border-none shadow-lg shadow-ursb/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-ursb/40 focus:ring-2 focus:ring-offset-2 focus:ring-ursb/50",
    primary:
      "rounded-xl py-2 px-4 text-sm bg-[#6a94d4] text-[#f9f8f6] border-none transition-colors duration-150 hover:bg-[#f9f8f6] hover:text-[#6a94d4] focus:ring-2 focus:ring-offset-2 focus:ring-[#6a94d4]/50",
    outline:
      "rounded-xl py-2 px-4 text-sm bg-[#6a94d4] text-[#f9f8f6] border-none transition-colors duration-150 hover:bg-[#f9f8f6] hover:text-[#6a94d4] focus:ring-2 focus:ring-offset-2 focus:ring-[#6a94d4]/50",
    "danger-outline":
      "rounded-xl py-2 px-4 text-sm bg-red-500 text-white border-2 border-transparent transition-colors duration-150 hover:bg-white hover:text-red-500 hover:border-red-500 focus:ring-2 focus:ring-offset-2 focus:ring-red-500/50",
    "danger-inverse":
      "rounded-xl py-2 px-4 text-sm bg-white text-red-500 border-2 border-transparent transition-colors duration-150 hover:bg-red-500 hover:text-white hover:border-red-500 focus:ring-2 focus:ring-offset-2 focus:ring-red-500/50",
    success:
      "rounded-xl py-2 px-4 text-sm bg-white text-emerald-500 border-2 border-transparent transition-colors duration-150 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500/50",
    ghost:
      "rounded-xl py-2 px-4 text-sm bg-transparent text-ink border-none transition-colors duration-150 hover:bg-sky-page/60 focus:ring-2 focus:ring-offset-2 focus:ring-[#6a94d4]/50",
    icon:
      "w-10 h-10 rounded-xl bg-transparent text-ink border-none transition-colors duration-150 hover:bg-sky-page/60 focus:ring-2 focus:ring-offset-2 focus:ring-[#6a94d4]/50 p-0",
    nav:
      "w-full rounded-xl py-2.5 px-3 text-sm gap-3 text-ink bg-transparent border-none shadow-none hover:bg-white hover:text-ursb-dark focus:outline-none !justify-start",
  };

  const activeNav =
    variant === "nav" && active
      ? "bg-white text-ursb-dark shadow-sm border-none"
      : "";

  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${activeNav} ${widthStyle} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current motion-reduce:animate-none"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
