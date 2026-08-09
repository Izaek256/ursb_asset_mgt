import Button from "./common/Button";

type Props = {
  message: string;
  onRetry?: () => void;
};

export default function ErrorMessage({ message, onRetry }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-badge-roseBg border border-badge-roseText/20 text-badge-roseText text-sm animate-fadeIn motion-reduce:animate-none">
      <p className="font-semibold">{message}</p>
      {onRetry && (
        <Button variant="danger-outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
