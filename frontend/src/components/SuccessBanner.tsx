type Props = {
  message: string;
  onDismiss?: () => void;
};

export default function SuccessBanner({ message, onDismiss }: Props) {
  return (
    <div className="alert-success">
      <p>{message}</p>
      {onDismiss && (
        <button className="btn btn-secondary btn-sm" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
