import React from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const ToastItem: React.FC<ToastProps> = ({ toast, onClose }) => {
  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      case "info":
        return "ℹ";
    }
  };

  const getStyles = () => {
    switch (toast.type) {
      case "success":
        return {
          bg: "bg-white",
          border: "border-l-emerald-500",
          icon: "bg-emerald-500",
          title: "text-gray-900",
          message: "text-gray-600",
          iconText: "text-white",
        };
      case "error":
        return {
          bg: "bg-white",
          border: "border-l-red-500",
          icon: "bg-red-500",
          title: "text-gray-900",
          message: "text-gray-600",
          iconText: "text-white",
        };
      case "warning":
        return {
          bg: "bg-white",
          border: "border-l-amber-500",
          icon: "bg-amber-500",
          title: "text-gray-900",
          message: "text-gray-600",
          iconText: "text-white",
        };
      case "info":
        return {
          bg: "bg-white",
          border: "border-l-[#185FA5]",
          icon: "bg-[#185FA5]",
          title: "text-gray-900",
          message: "text-gray-600",
          iconText: "text-white",
        };
    }
  };

  const styles = getStyles();
  const duration = toast.duration || 5000;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onClose]);

  return (
    <div
      className={`${styles.bg} ${styles.border} border-l-4 rounded-lg shadow-xl p-4 mb-3 flex items-start gap-3 min-w-[320px] max-w-md animate-slide-in`}
      style={{
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div className={`${styles.icon} ${styles.iconText} flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm`}>
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`font-semibold ${styles.title} text-sm leading-tight mb-1`}>{toast.title}</h4>
        {toast.message && (
          <p className={`text-sm ${styles.message} leading-relaxed`}>{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded border-none outline-none hover:bg-gray-100 focus:outline-none focus:ring-0"
        aria-label="Close notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default function ToastContainer() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback(
    (type: ToastType, title: string, message: string, duration?: number) => {
      const id = Math.random().toString(36).substring(7);
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);
      return id;
    },
    []
  );

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Expose toast functions globally
  React.useEffect(() => {
    (window as any).toast = {
      success: (title: string, message?: string, duration?: number) =>
        addToast("success", title, message || "", duration),
      error: (title: string, message?: string, duration?: number) =>
        addToast("error", title, message || "", duration),
      warning: (title: string, message?: string, duration?: number) =>
        addToast("warning", title, message || "", duration),
      info: (title: string, message?: string, duration?: number) =>
        addToast("info", title, message || "", duration),
    };
  }, [addToast]);

  return (
    <div className="fixed top-6 right-6 z-[10000] flex flex-col gap-3 pointer-events-none">
      <div className="pointer-events-auto">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </div>
  );
}
