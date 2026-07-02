import { ICONS } from "../../utils/icons";

export type Props = {
  message: string;
  onDismiss?: () => void;
};

export default function SuccessBanner({ message, onDismiss }: Props) {
  return (
    <div className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-emerald-500/16 border border-emerald-500/30 backdrop-blur-md text-emerald-200 text-sm shadow-md animate-fadeIn motion-reduce:animate-none">
      <div className="flex items-center gap-2.5">
        <ICONS.checkCircle className="w-5 h-5 text-emerald-400 shrink-0" />
        <span className="font-medium">{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-emerald-400 hover:text-emerald-200 hover:bg-emerald-500/10 p-1.5 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          aria-label="Dismiss banner"
        >
          {/* Simple X close representation */}
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
