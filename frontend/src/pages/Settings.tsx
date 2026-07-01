import React from "react";
import { useAuth } from "../AuthContext";
import { apiFetch } from "../AuthContext";
import { UserSettings, SystemSettings } from "../types";
import FormInput from "../components/FormInput";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import SuccessBanner from "../components/SuccessBanner";
import EmptyState from "../components/EmptyState";

export default function Settings() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = React.useState("general");

  // Settings data state
  const [isLoadingSettings, setIsLoadingSettings] = React.useState(true);
  const [settingsError, setSettingsError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // General tab form state
  const [generalForm, setGeneralForm] = React.useState({
    theme: "light" as "light" | "dark",
    language: "en" as "en" | "fr",
  });
  const [isSavingGeneral, setIsSavingGeneral] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);

  // Notifications tab form state
  const [notificationsForm, setNotificationsForm] = React.useState({
    notifications_email: false,
    notifications_in_app: false,
    notifications_maintenance_alerts: false,
    notifications_transfer_alerts: false,
    notifications_request_updates: false,
  });
  const [isSavingNotifications, setIsSavingNotifications] = React.useState(false);
  const [notificationsError, setNotificationsError] = React.useState<string | null>(null);

  // System tab form state
  const [systemForm, setSystemForm] = React.useState({
    organisation_name: "",
    asset_id_prefix: "",
    session_timeout_hours: 8,
    max_failed_login_attempts: 5,
  });
  const [isSavingSystem, setIsSavingSystem] = React.useState(false);
  const [systemFormError, setSystemFormError] = React.useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmNewPassword, setConfirmNewPassword] = React.useState("");
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = React.useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);

  // Load settings on mount
  React.useEffect(() => {
    const loadSettings = async () => {
      setIsLoadingSettings(true);
      setSettingsError(null);

      try {
        // Parallel fetch — both calls are independent and can resolve concurrently
        const [userSettingsData, systemSettingsData] = await Promise.all([
          apiFetch<UserSettings>("/settings"),
          user?.role === "System Administrator" 
            ? apiFetch<SystemSettings>("/settings/system")
            : Promise.resolve(null),
        ]);

        if (userSettingsData) {
          setGeneralForm({
            theme: userSettingsData.theme,
            language: userSettingsData.language,
          });
          setNotificationsForm({
            notifications_email: userSettingsData.notifications_email,
            notifications_in_app: userSettingsData.notifications_in_app,
            notifications_maintenance_alerts: userSettingsData.notifications_maintenance_alerts,
            notifications_transfer_alerts: userSettingsData.notifications_transfer_alerts,
            notifications_request_updates: userSettingsData.notifications_request_updates,
          });
        }

        if (systemSettingsData) {
          setSystemForm({
            organisation_name: systemSettingsData.organisation_name,
            asset_id_prefix: systemSettingsData.asset_id_prefix,
            session_timeout_hours: systemSettingsData.session_timeout_hours,
            max_failed_login_attempts: systemSettingsData.max_failed_login_attempts,
          });
        }
      } catch (err: any) {
        setSettingsError(err.message || "Failed to load settings");
      } finally {
        setIsLoadingSettings(false);
      }
    };

    loadSettings();
  }, [user?.role]);

  // General tab handlers
  const handleGeneralSave = async () => {
    setGeneralError(null);
    setIsSavingGeneral(true);

    try {
      await apiFetch("/settings", {
        method: "PUT",
        body: JSON.stringify({
          theme: generalForm.theme,
          language: generalForm.language,
        }),
      });

      setSuccessMessage("General settings saved.");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setGeneralError(err.message || "Failed to save general settings");
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // Notifications tab handlers
  const handleNotificationsSave = async () => {
    setNotificationsError(null);
    setIsSavingNotifications(true);

    try {
      await apiFetch("/settings", {
        method: "PUT",
        body: JSON.stringify(notificationsForm),
      });

      setSuccessMessage("Notification preferences saved.");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setNotificationsError(err.message || "Failed to save notification preferences");
    } finally {
      setIsSavingNotifications(false);
    }
  };

  // System tab handlers
  const handleSystemSave = async () => {
    setSystemFormError(null);
    setIsSavingSystem(true);

    try {
      await apiFetch("/settings/system", {
        method: "PUT",
        body: JSON.stringify(systemForm),
      });

      setSuccessMessage("System settings saved.");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setSystemFormError(err.message || "Failed to save system settings");
    } finally {
      setIsSavingSystem(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    // Client-side validation
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError("Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiFetch("/password", {
        method: "PUT",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_new_password: confirmNewPassword,
        }),
      });

      // Store success message in sessionStorage and redirect to login
      sessionStorage.setItem("post_auth_message", "Your password has been changed. Please log in with your new password.");
      logout();
    } catch (err: any) {
      setPasswordError(err.message || "Password change failed.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="settings-page">
      {successMessage && <SuccessBanner message={successMessage} onDismiss={() => setSuccessMessage(null)} />}
      {isLoadingSettings && <div className="page-loading"><LoadingSpinner /> Loading settings...</div>}
      {settingsError && <ErrorMessage message={settingsError} />}

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
            <FormInput
              type="select"
              label="Theme"
              value={generalForm.theme}
              onChange={(v) => setGeneralForm({ ...generalForm, theme: v as "light" | "dark" })}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
            <FormInput
              type="select"
              label="Language"
              value={generalForm.language}
              onChange={(v) => setGeneralForm({ ...generalForm, language: v as "en" | "fr" })}
              options={[
                { value: "en", label: "English" },
                { value: "fr", label: "French" },
              ]}
            />
          </div>
          {generalError && <ErrorMessage message={generalError} />}
          <div className="settings-footer">
            <button className="btn btn-primary" onClick={handleGeneralSave} disabled={isSavingGeneral}>
              {isSavingGeneral ? <LoadingSpinner size="sm" /> : "Save Changes"}
            </button>
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
            <FormInput
              type="checkbox"
              label="Email Notifications"
              checked={notificationsForm.notifications_email}
              onChange={(v) => setNotificationsForm({ ...notificationsForm, notifications_email: v })}
              helper="Receive email alerts for important events"
            />
            <FormInput
              type="checkbox"
              label="In-App Notifications"
              checked={notificationsForm.notifications_in_app}
              onChange={(v) => setNotificationsForm({ ...notificationsForm, notifications_in_app: v })}
              helper="Receive in-app notifications"
            />
            <FormInput
              type="checkbox"
              label="Maintenance Alerts"
              checked={notificationsForm.notifications_maintenance_alerts}
              onChange={(v) => setNotificationsForm({ ...notificationsForm, notifications_maintenance_alerts: v })}
              helper="Alert when assets are due for maintenance"
            />
            <FormInput
              type="checkbox"
              label="Transfer Alerts"
              checked={notificationsForm.notifications_transfer_alerts}
              onChange={(v) => setNotificationsForm({ ...notificationsForm, notifications_transfer_alerts: v })}
              helper="Notify when a new asset transfer is requested"
            />
            <FormInput
              type="checkbox"
              label="Request Updates"
              checked={notificationsForm.notifications_request_updates}
              onChange={(v) => setNotificationsForm({ ...notificationsForm, notifications_request_updates: v })}
              helper="Notify about asset request status updates"
            />
          </div>
          {notificationsError && <ErrorMessage message={notificationsError} />}
          <div className="settings-footer">
            <button className="btn btn-primary" onClick={handleNotificationsSave} disabled={isSavingNotifications}>
              {isSavingNotifications ? <LoadingSpinner size="sm" /> : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Security Settings */}
      {activeTab === "security" && (
        <div className="card settings-card">
          <div className="card-header">
            <h2 className="card-title">Security Settings</h2>
          </div>
          <div className="settings-form">
            {/* Password Change Section */}
            <div className="settings-section">
              <h3 className="settings-section-title">Change Password</h3>
              {passwordError && <div className="alert-error">{passwordError}</div>}
              {passwordSuccess && <div className="alert-success">{passwordSuccess}</div>}
              <form onSubmit={handlePasswordChange}>
                <div className="form-group">
                  <label className="form-label" htmlFor="current-password">Current Password</label>
                  <input
                    id="current-password"
                    type="password"
                    className="form-control"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-password">New Password</label>
                  <input
                    id="new-password"
                    type="password"
                    className="form-control"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters (with A-Z, a-z, 0-9, special)"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="confirm-new-password">Confirm New Password</label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    className="form-control"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? "Changing Password..." : "Change Password"}
                </button>
              </form>
            </div>

            <hr className="settings-divider" />

            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Session Timeout</span>
                <span className="settings-label-desc">Auto-logout after inactivity (minutes)</span>
              </div>
              <select className="settings-select" defaultValue="480">
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="240">4 hours</option>
                <option value="480">8 hours</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Password Policy</span>
                <span className="settings-label-desc">Minimum requirements for user passwords</span>
              </div>
              <select className="settings-select" defaultValue="strong">
                <option value="basic">Basic (8+ characters)</option>
                <option value="moderate">Moderate (uppercase, lowercase, number)</option>
                <option value="strong">Strong (mixed case, number, special char)</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Two-Factor Authentication</span>
                <span className="settings-label-desc">Require 2FA for all admin accounts</span>
              </div>
              <label className="settings-toggle">
                <input type="checkbox" />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">Audit Logging</span>
                <span className="settings-label-desc">Record all user actions for compliance</span>
              </div>
              <label className="settings-toggle">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* System Settings */}
      {activeTab === "system" && (
        <div className="card settings-card">
          <div className="card-header">
            <h2 className="card-title">System Settings</h2>
          </div>
          {/* Conditional render by role — non-admins see a placeholder */}
          {user?.role === "System Administrator" ? (
            <>
              <div className="settings-form">
                <FormInput
                  type="text"
                  label="Organisation Name"
                  value={systemForm.organisation_name}
                  onChange={(v) => setSystemForm({ ...systemForm, organisation_name: v })}
                  helper="Name of the organization"
                />
                <FormInput
                  type="text"
                  label="Asset ID Prefix"
                  value={systemForm.asset_id_prefix}
                  onChange={(v) => setSystemForm({ ...systemForm, asset_id_prefix: v })}
                  helper="Prefix for asset IDs"
                />
                <FormInput
                  type="number"
                  label="Session Timeout Hours"
                  value={systemForm.session_timeout_hours}
                  onChange={(v) => setSystemForm({ ...systemForm, session_timeout_hours: parseInt(v, 10) })}
                  helper="Session timeout in hours"
                  error={systemForm.session_timeout_hours < 1 || systemForm.session_timeout_hours > 168 ? "Must be between 1 and 168 hours" : undefined}
                />
                <FormInput
                  type="number"
                  label="Max Failed Login Attempts"
                  value={systemForm.max_failed_login_attempts}
                  onChange={(v) => setSystemForm({ ...systemForm, max_failed_login_attempts: parseInt(v, 10) })}
                  helper="Maximum failed login attempts before lockout"
                  error={systemForm.max_failed_login_attempts < 1 || systemForm.max_failed_login_attempts > 10 ? "Must be between 1 and 10" : undefined}
                />
              </div>
              {systemFormError && <ErrorMessage message={systemFormError} />}
              <div className="settings-footer">
                <button
                  className="btn btn-primary"
                  onClick={handleSystemSave}
                  disabled={isSavingSystem || systemForm.session_timeout_hours < 1 || systemForm.session_timeout_hours > 168 || systemForm.max_failed_login_attempts < 1 || systemForm.max_failed_login_attempts > 10}
                >
                  {isSavingSystem ? <LoadingSpinner size="sm" /> : "Save Changes"}
                </button>
              </div>
            </>
          ) : (
            <EmptyState icon="⚙️" title="System Settings" description="System settings are only available to System Administrators." />
          )}
        </div>
      )}
    </div>
  );
}
