import { useAuth } from "../AuthContext";
import Button from "./common/Button";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ROLE_CLASS: Record<string, string> = {
  "System Administrator": "role-admin",
  "Asset Manager": "role-manager",
  "Asset Custodian": "role-custodian",
  "Employee": "role-employee",
};

export default function ProfileModal({ open, onClose }: Props) {
  const { user } = useAuth();
  if (!open || !user) return null;

  const initials = user.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleCls = ROLE_CLASS[user.role] || "role-employee";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <div className={`profile-modal-avatar ${roleCls}`}>
            {initials}
          </div>
          <div>
            <h3 className="modal-title">{user.full_name}</h3>
            <span className={`badge ${roleCls}`}>
              {user.role}
            </span>
          </div>
        </div>

        <div className="profile-modal-body">
          <div className="profile-detail-row">
            <span className="profile-detail-label">Email</span>
            <span className="profile-detail-value">{user.email}</span>
          </div>
          <div className="profile-detail-row">
            <span className="profile-detail-label">Department</span>
            <span className="profile-detail-value">{user.department}</span>
          </div>
          <div className="profile-detail-row">
            <span className="profile-detail-label">Account Status</span>
            <span className={`badge ${user.is_active ? "badge-active" : "badge-inactive"}`}>
              {user.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="profile-detail-row">
            <span className="profile-detail-label">User ID</span>
            <span className="profile-detail-value text-small">{user.user_id}</span>
          </div>
          {user.created_at && (
            <div className="profile-detail-row">
              <span className="profile-detail-label">Member Since</span>
              <span className="profile-detail-value">
                {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
