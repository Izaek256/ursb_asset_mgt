import React from "react";
import { useAuth } from "../AuthContext";

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState("general");
  const [saved, setSaved] = React.useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
            <h2 className="card-title">Security Settings</h2>
          </div>
          <div className="settings-form">
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
          <div className="settings-footer">
            <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
          </div>
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
