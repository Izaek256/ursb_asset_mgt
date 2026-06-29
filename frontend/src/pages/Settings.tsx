import React from "react";
import { useAuth, apiFetch } from "../AuthContext";

export default function Settings() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = React.useState("general");
  const [saved, setSaved] = React.useState(false);

  // Password change form
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    // Client-side validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiFetch("/auth/password", {
        method: "PUT",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_new_password: confirmPassword,
        }),
      });
      // Success: logout and redirect to login
      sessionStorage.setItem("post_auth_message", "Your password has been changed. Please log in with your new password.");
      await logout();
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="settings-page">
      {saved && <div className="alert-success">Settings saved successfully.</div>}

      {/* Tabs */}
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === "general" ? "active" : ""}`}
          onClick={() => setActiveTab("general")}
        >
          General
        </button>
        <button
          className={`settings-tab ${activeTab === "notifications" ? "active" : ""}`}
          onClick={() => setActiveTab("notifications")}
        >
          Notifications
        </button>
        <button
          className={`settings-tab ${activeTab === "security" ? "active" : ""}`}
          onClick={() => setActiveTab("security")}
        >
          Security
        </button>
        <button
          className={`settings-tab ${activeTab === "system" ? "active" : ""}`}
          onClick={() => setActiveTab("system")}
        >
          System
        </button>
      </div>

      {/* General Settings */}
      {activeTab === "general" && (
        <div className="card settings-card">
          <div className="card-header">
            <h2 className="card-title">General Settings</h2>
          </div>
          <div className="settings-form">
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Organization Name</span>
                <span className="settings-label-desc">Displayed in the sidebar and login page</span>
              </div>
              <input className="settings-input" defaultValue="URSB - Uganda Registration Services Bureau" />
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">System Name</span>
                <span className="settings-label-desc">Name of this application</span>
              </div>
              <input className="settings-input" defaultValue="Asset Management System" />
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Currency</span>
                <span className="settings-label-desc">Default currency for asset values</span>
              </div>
              <select className="settings-select" defaultValue="UGX">
                <option value="UGX">UGX - Ugandan Shilling</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Date Format</span>
                <span className="settings-label-desc">How dates are displayed throughout the system</span>
              </div>
              <select className="settings-select" defaultValue="DD/MM/YYYY">
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Fiscal Year Start</span>
                <span className="settings-label-desc">Starting month for the fiscal year</span>
              </div>
              <select className="settings-select" defaultValue="7">
                <option value="1">January</option>
                <option value="4">April</option>
                <option value="7">July</option>
                <option value="10">October</option>
              </select>
            </div>
          </div>
          <div className="settings-footer">
            <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
          </div>
        </div>
      )}

      {/* Notification Settings */}
      {activeTab === "notifications" && (
        <div className="card settings-card">
          <div className="card-header">
            <h2 className="card-title">Notification Preferences</h2>
          </div>
          <div className="settings-form">
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Email Notifications</span>
                <span className="settings-label-desc">Receive email alerts for important events</span>
              </div>
              <label className="settings-toggle">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Maintenance Reminders</span>
                <span className="settings-label-desc">Alert when assets are due for maintenance</span>
              </div>
              <label className="settings-toggle">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Transfer Requests</span>
                <span className="settings-label-desc">Notify when a new asset transfer is requested</span>
              </div>
              <label className="settings-toggle">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Role Change Alerts</span>
                <span className="settings-label-desc">Notify when user roles are modified</span>
              </div>
              <label className="settings-toggle">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Disposal Approvals</span>
                <span className="settings-label-desc">Alert for asset disposal approval</span>
              </div>
              <label className="settings-toggle">
                <input type="checkbox" />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div className="settings-footer">
            <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
          </div>
        </div>
      )}

      {/* Security Settings */}
      {activeTab === "security" && (
        <div className="card settings-card">
          <div className="card-header">
            <h2 className="card-title">Change Password</h2>
          </div>
          <form onSubmit={handlePasswordChange} className="settings-form">
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                className="form-control"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-control"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {passwordError && confirmPassword && newPassword !== confirmPassword && (
                <div className="alert-error" style={{ marginTop: "8px" }}>
                  Passwords do not match
                </div>
              )}
            </div>
            {passwordError && !confirmPassword && (
              <div className="alert-error" style={{ marginBottom: "16px" }}>
                {passwordError}
              </div>
            )}
            <div className="settings-footer">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isChangingPassword}
              >
                {isChangingPassword ? "Changing..." : "Change Password"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* System Settings */}
      {activeTab === "system" && (
        <div className="card settings-card">
          <div className="card-header">
            <h2 className="card-title">System Information</h2>
          </div>
          <div className="settings-form">
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Logged In As</span>
                <span className="settings-label-desc">Current administrator account</span>
              </div>
              <span className="settings-value">{user?.full_name} ({user?.email})</span>
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">System Version</span>
                <span className="settings-label-desc">Current application version</span>
              </div>
              <span className="settings-value">v1.0.0</span>
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Database</span>
                <span className="settings-label-desc">Backend database status</span>
              </div>
              <span className="badge badge-active">Connected</span>
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Export Data</span>
                <span className="settings-label-desc">Download a full system data export</span>
              </div>
              <button className="btn btn-secondary btn-sm">Export CSV</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
