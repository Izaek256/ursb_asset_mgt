type Props = {
  open: boolean;
  title?: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        {title && <h3 className="modal-title">{title}</h3>}
        <div className="modal-body">
          <p className="text-small text-muted">{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            Confirm &amp; Apply
          </button>
        </div>
      </div>
    </div>
  );
}
