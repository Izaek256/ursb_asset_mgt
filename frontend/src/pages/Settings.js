import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from "react";
import { useAuth } from "../AuthContext";
import { apiFetch } from "../AuthContext";
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
    const [settingsError, setSettingsError] = React.useState(null);
    const [successMessage, setSuccessMessage] = React.useState(null);
    // General tab form state
    const [generalForm, setGeneralForm] = React.useState({
        theme: "light",
        language: "en",
    });
    const [isSavingGeneral, setIsSavingGeneral] = React.useState(false);
    const [generalError, setGeneralError] = React.useState(null);
    // Notifications tab form state
    const [notificationsForm, setNotificationsForm] = React.useState({
        notifications_email: false,
        notifications_in_app: false,
        notifications_maintenance_alerts: false,
        notifications_transfer_alerts: false,
        notifications_request_updates: false,
    });
    const [isSavingNotifications, setIsSavingNotifications] = React.useState(false);
    const [notificationsError, setNotificationsError] = React.useState(null);
    // System tab form state
    const [systemForm, setSystemForm] = React.useState({
        organisation_name: "",
        asset_id_prefix: "",
        session_timeout_hours: 8,
        max_failed_login_attempts: 5,
    });
    const [isSavingSystem, setIsSavingSystem] = React.useState(false);
    const [systemFormError, setSystemFormError] = React.useState(null);
    // Password change state
    const [currentPassword, setCurrentPassword] = React.useState("");
    const [newPassword, setNewPassword] = React.useState("");
    const [confirmNewPassword, setConfirmNewPassword] = React.useState("");
    const [passwordError, setPasswordError] = React.useState(null);
    const [passwordSuccess, setPasswordSuccess] = React.useState(null);
    const [isChangingPassword, setIsChangingPassword] = React.useState(false);
    // Load settings on mount
    React.useEffect(() => {
        const loadSettings = async () => {
            setIsLoadingSettings(true);
            setSettingsError(null);
            try {
                // Parallel fetch — both calls are independent and can resolve concurrently
                const [userSettingsData, systemSettingsData] = await Promise.all([
                    apiFetch("/settings"),
                    user?.role === "System Administrator"
                        ? apiFetch("/settings/system")
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
            }
            catch (err) {
                setSettingsError(err.message || "Failed to load settings");
            }
            finally {
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
        }
        catch (err) {
            setGeneralError(err.message || "Failed to save general settings");
        }
        finally {
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
        }
        catch (err) {
            setNotificationsError(err.message || "Failed to save notification preferences");
        }
        finally {
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
        }
        catch (err) {
            setSystemFormError(err.message || "Failed to save system settings");
        }
        finally {
            setIsSavingSystem(false);
        }
    };
    const handlePasswordChange = async (e) => {
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
        }
        catch (err) {
            setPasswordError(err.message || "Password change failed.");
        }
        finally {
            setIsChangingPassword(false);
        }
    };
    return (_jsxs("div", { className: "settings-page", children: [successMessage && _jsx(SuccessBanner, { message: successMessage, onDismiss: () => setSuccessMessage(null) }), isLoadingSettings && _jsxs("div", { className: "page-loading", children: [_jsx(LoadingSpinner, {}), " Loading settings..."] }), settingsError && _jsx(ErrorMessage, { message: settingsError }), _jsxs("div", { className: "settings-tabs", children: [_jsx("button", { className: `settings-tab ${activeTab === "general" ? "active" : ""}`, onClick: () => setActiveTab("general"), children: "General" }), _jsx("button", { className: `settings-tab ${activeTab === "notifications" ? "active" : ""}`, onClick: () => setActiveTab("notifications"), children: "Notifications" }), _jsx("button", { className: `settings-tab ${activeTab === "security" ? "active" : ""}`, onClick: () => setActiveTab("security"), children: "Security" }), _jsx("button", { className: `settings-tab ${activeTab === "system" ? "active" : ""}`, onClick: () => setActiveTab("system"), children: "System" })] }), activeTab === "general" && (_jsxs("div", { className: "card settings-card", children: [_jsx("div", { className: "card-header", children: _jsx("h2", { className: "card-title", children: "General Settings" }) }), _jsxs("div", { className: "settings-form", children: [_jsx(FormInput, { type: "select", label: "Theme", value: generalForm.theme, onChange: (v) => setGeneralForm({ ...generalForm, theme: v }), options: [
                                    { value: "light", label: "Light" },
                                    { value: "dark", label: "Dark" },
                                ] }), _jsx(FormInput, { type: "select", label: "Language", value: generalForm.language, onChange: (v) => setGeneralForm({ ...generalForm, language: v }), options: [
                                    { value: "en", label: "English" },
                                    { value: "fr", label: "French" },
                                ] })] }), generalError && _jsx(ErrorMessage, { message: generalError }), _jsx("div", { className: "settings-footer", children: _jsx("button", { className: "btn btn-primary", onClick: handleGeneralSave, disabled: isSavingGeneral, children: isSavingGeneral ? _jsx(LoadingSpinner, { size: "sm" }) : "Save Changes" }) })] })), activeTab === "notifications" && (_jsxs("div", { className: "card settings-card", children: [_jsx("div", { className: "card-header", children: _jsx("h2", { className: "card-title", children: "Notification Preferences" }) }), _jsxs("div", { className: "settings-form", children: [_jsx(FormInput, { type: "checkbox", label: "Email Notifications", checked: notificationsForm.notifications_email, onChange: (v) => setNotificationsForm({ ...notificationsForm, notifications_email: v }), helper: "Receive email alerts for important events" }), _jsx(FormInput, { type: "checkbox", label: "In-App Notifications", checked: notificationsForm.notifications_in_app, onChange: (v) => setNotificationsForm({ ...notificationsForm, notifications_in_app: v }), helper: "Receive in-app notifications" }), _jsx(FormInput, { type: "checkbox", label: "Maintenance Alerts", checked: notificationsForm.notifications_maintenance_alerts, onChange: (v) => setNotificationsForm({ ...notificationsForm, notifications_maintenance_alerts: v }), helper: "Alert when assets are due for maintenance" }), _jsx(FormInput, { type: "checkbox", label: "Transfer Alerts", checked: notificationsForm.notifications_transfer_alerts, onChange: (v) => setNotificationsForm({ ...notificationsForm, notifications_transfer_alerts: v }), helper: "Notify when a new asset transfer is requested" }), _jsx(FormInput, { type: "checkbox", label: "Request Updates", checked: notificationsForm.notifications_request_updates, onChange: (v) => setNotificationsForm({ ...notificationsForm, notifications_request_updates: v }), helper: "Notify about asset request status updates" })] }), notificationsError && _jsx(ErrorMessage, { message: notificationsError }), _jsx("div", { className: "settings-footer", children: _jsx("button", { className: "btn btn-primary", onClick: handleNotificationsSave, disabled: isSavingNotifications, children: isSavingNotifications ? _jsx(LoadingSpinner, { size: "sm" }) : "Save Changes" }) })] })), activeTab === "security" && (_jsxs("div", { className: "card settings-card", children: [_jsx("div", { className: "card-header", children: _jsx("h2", { className: "card-title", children: "Security Settings" }) }), _jsxs("div", { className: "settings-form", children: [_jsxs("div", { className: "settings-section", children: [_jsx("h3", { className: "settings-section-title", children: "Change Password" }), passwordError && _jsx("div", { className: "alert-error", children: passwordError }), passwordSuccess && _jsx("div", { className: "alert-success", children: passwordSuccess }), _jsxs("form", { onSubmit: handlePasswordChange, children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "current-password", children: "Current Password" }), _jsx("input", { id: "current-password", type: "password", className: "form-control", value: currentPassword, onChange: (e) => setCurrentPassword(e.target.value), required: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "new-password", children: "New Password" }), _jsx("input", { id: "new-password", type: "password", className: "form-control", value: newPassword, onChange: (e) => setNewPassword(e.target.value), placeholder: "Min. 8 characters (with A-Z, a-z, 0-9, special)", required: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "confirm-new-password", children: "Confirm New Password" }), _jsx("input", { id: "confirm-new-password", type: "password", className: "form-control", value: confirmNewPassword, onChange: (e) => setConfirmNewPassword(e.target.value), placeholder: "Re-enter your new password", required: true })] }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isChangingPassword, children: isChangingPassword ? "Changing Password..." : "Change Password" })] })] }), _jsx("hr", { className: "settings-divider" }), _jsxs("div", { className: "settings-row", children: [_jsxs("div", { className: "settings-label", children: [_jsx("span", { className: "settings-label-title", children: "Session Timeout" }), _jsx("span", { className: "settings-label-desc", children: "Auto-logout after inactivity (minutes)" })] }), _jsxs("select", { className: "settings-select", defaultValue: "480", children: [_jsx("option", { value: "30", children: "30 minutes" }), _jsx("option", { value: "60", children: "1 hour" }), _jsx("option", { value: "240", children: "4 hours" }), _jsx("option", { value: "480", children: "8 hours" })] })] }), _jsxs("div", { className: "settings-row", children: [_jsxs("div", { className: "settings-label", children: [_jsx("span", { className: "settings-label-title", children: "Password Policy" }), _jsx("span", { className: "settings-label-desc", children: "Minimum requirements for user passwords" })] }), _jsxs("select", { className: "settings-select", defaultValue: "strong", children: [_jsx("option", { value: "basic", children: "Basic (8+ characters)" }), _jsx("option", { value: "moderate", children: "Moderate (uppercase, lowercase, number)" }), _jsx("option", { value: "strong", children: "Strong (mixed case, number, special char)" })] })] }), _jsxs("div", { className: "settings-row", children: [_jsxs("div", { className: "settings-label", children: [_jsx("span", { className: "settings-label-title", children: "Two-Factor Authentication" }), _jsx("span", { className: "settings-label-desc", children: "Require 2FA for all admin accounts" })] }), _jsxs("label", { className: "settings-toggle", children: [_jsx("input", { type: "checkbox" }), _jsx("span", { className: "toggle-slider" })] })] }), _jsxs("div", { className: "settings-row", children: [_jsxs("div", { className: "settings-label", children: [_jsx("span", { className: "settings-label-title", children: "Audit Logging" }), _jsx("span", { className: "settings-label-desc", children: "Record all user actions for compliance" })] }), _jsxs("label", { className: "settings-toggle", children: [_jsx("input", { type: "checkbox", defaultChecked: true }), _jsx("span", { className: "toggle-slider" })] })] })] })] })), activeTab === "system" && (_jsxs("div", { className: "card settings-card", children: [_jsx("div", { className: "card-header", children: _jsx("h2", { className: "card-title", children: "System Settings" }) }), user?.role === "System Administrator" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "settings-form", children: [_jsx(FormInput, { type: "text", label: "Organisation Name", value: systemForm.organisation_name, onChange: (v) => setSystemForm({ ...systemForm, organisation_name: v }), helper: "Name of the organization" }), _jsx(FormInput, { type: "text", label: "Asset ID Prefix", value: systemForm.asset_id_prefix, onChange: (v) => setSystemForm({ ...systemForm, asset_id_prefix: v }), helper: "Prefix for asset IDs" }), _jsx(FormInput, { type: "number", label: "Session Timeout Hours", value: systemForm.session_timeout_hours, onChange: (v) => setSystemForm({ ...systemForm, session_timeout_hours: parseInt(v, 10) }), helper: "Session timeout in hours", error: systemForm.session_timeout_hours < 1 || systemForm.session_timeout_hours > 168 ? "Must be between 1 and 168 hours" : undefined }), _jsx(FormInput, { type: "number", label: "Max Failed Login Attempts", value: systemForm.max_failed_login_attempts, onChange: (v) => setSystemForm({ ...systemForm, max_failed_login_attempts: parseInt(v, 10) }), helper: "Maximum failed login attempts before lockout", error: systemForm.max_failed_login_attempts < 1 || systemForm.max_failed_login_attempts > 10 ? "Must be between 1 and 10" : undefined })] }), systemFormError && _jsx(ErrorMessage, { message: systemFormError }), _jsx("div", { className: "settings-footer", children: _jsx("button", { className: "btn btn-primary", onClick: handleSystemSave, disabled: isSavingSystem || systemForm.session_timeout_hours < 1 || systemForm.session_timeout_hours > 168 || systemForm.max_failed_login_attempts < 1 || systemForm.max_failed_login_attempts > 10, children: isSavingSystem ? _jsx(LoadingSpinner, { size: "sm" }) : "Save Changes" }) })] })) : (_jsx(EmptyState, { icon: "\u2699\uFE0F", title: "System Settings", description: "System settings are only available to System Administrators." }))] }))] }));
}
