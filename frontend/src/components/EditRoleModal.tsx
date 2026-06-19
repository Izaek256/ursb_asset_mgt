import React from "react";
import { Role, UserRow } from "../types";

type Props = {
  user: UserRow | null;
  open: boolean;
  onClose: () => void;
  onRequestConfirm: (newRole: Role) => void;
};

const ROLE_OPTIONS: Role[] = [
  "System Administrator",
  "Asset Manager",
  "Asset Custodian",
  "Employee",
];

export default function EditRoleModal({ user, open, onClose, onRequestConfirm }: Props) {
  const [selected, setSelected] = React.useState<Role | null>(null);

  React.useEffect(() => {
    setSelected(user ? user.role : null);
  }, [user, open]);

  if (!open || !user) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Edit Role</h3>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="read-only-label">Name</label>
            <div className="read-only-text">{user.name}</div>
          </div>

          <div className="form-group">
            <label className="read-only-label">Email</label>
            <div className="read-only-text">{user.email}</div>
          </div>

          <div className="form-group">
            <label htmlFor="role" className="form-label">
              Role
            </label>
            <select
              id="role"
              value={selected ?? ""}
              onChange={(e) => setSelected(e.target.value as Role)}
              className="form-control"
            >
              <option value="">Select a role...</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => selected && onRequestConfirm(selected)}
            disabled={selected === user.role || !selected}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
