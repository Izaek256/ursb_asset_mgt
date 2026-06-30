import React from "react";

type Props = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

export default function LoadingSpinner({ size = "md", className = "" }: Props) {
  const sizeClass = size === "sm" ? "spinner-sm" : size === "lg" ? "spinner-lg" : "spinner";
  return <span className={`spinner ${sizeClass} ${className}`}></span>;
}
