import React from "react";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "wave" | "none";
}

export function Skeleton({
  className = "",
  variant = "text",
  width,
  height,
  animation = "pulse",
}: SkeletonProps) {
  const baseClasses = "bg-sky-border/50 motion-reduce:animate-none";
  
  const variantClasses = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-md",
  };

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-shimmer",
    none: "",
  };

  const style: React.CSSProperties = {
    width: width !== undefined ? (typeof width === "number" ? `${width}px` : width) : undefined,
    height: height !== undefined ? (typeof height === "number" ? `${height}px` : height) : undefined,
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className = "" }: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? "60%" : "100%"}
        />
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  className?: string;
  showAvatar?: boolean;
}

export function SkeletonCard({ className = "", showAvatar = false }: SkeletonCardProps) {
  return (
    <div className={`p-4 bg-white border border-sky-cardBorder rounded-2xl ${className}`}>
      {showAvatar && (
        <div className="flex items-center gap-3 mb-3">
          <Skeleton variant="circular" width={40} height={40} />
          <div className="flex-1">
            <Skeleton variant="text" width="70%" />
            <Skeleton variant="text" width="40%" />
          </div>
        </div>
      )}
      <SkeletonText lines={2} />
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 4, className = "" }: SkeletonTableProps) {
  return (
    <div className={`bg-white border border-sky-cardBorder rounded-2xl overflow-hidden ${className}`}>
      <div className="px-5 py-3 border-b border-sky-cardBorder bg-sky-topbar/50">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} variant="text" width="20%" height={16} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-sky-page/30">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="px-5 py-4">
            <div className="flex gap-4">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  variant="text"
                  width={colIndex === 0 ? "30%" : "20%"}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message = "Loading..." }: PageLoaderProps) {
  return (
    <div className="flex flex-col justify-center items-center h-screen bg-sky-page gap-5 select-none">
      <div className="relative">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-sky-border border-t-ursb motion-reduce:animate-none" />
        <div className="absolute inset-0 rounded-full h-12 w-12 border-4 border-transparent border-t-ursb/30 animate-pulse" />
      </div>
      <div className="text-base text-ink-dim font-semibold">{message}</div>
    </div>
  );
}

interface InlineLoaderProps {
  size?: "sm" | "md" | "lg";
  message?: string;
  className?: string;
}

export function InlineLoader({ size = "md", message, className = "" }: InlineLoaderProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-3",
    lg: "h-8 w-8 border-4",
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`animate-spin rounded-full ${sizeClasses[size]} border-sky-border border-t-ursb motion-reduce:animate-none`} />
      {message && <span className="text-sm text-ink-dim">{message}</span>}
    </div>
  );
}

interface ButtonLoaderProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function ButtonLoader({ isLoading, children, className = "", disabled = false }: ButtonLoaderProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      disabled={disabled || isLoading}
    >
      {isLoading && (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white motion-reduce:animate-none" />
      )}
      {children}
    </button>
  );
}
