import React from "react";

type Props = {
  message: string;
  onRetry?: () => void;
};

export default function ErrorMessage({ message, onRetry }: Props) {
  return (
    <div className="alert-error">
      <p>{message}</p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
