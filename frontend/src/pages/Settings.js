import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { Fragment } from "react";
import { Tab } from "@headlessui/react";
import { useAuth } from "../AuthContext";
import { apiFetch } from "../AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import SuccessBanner from "../components/common/SuccessBanner";
import EmptyState from "../components/EmptyState";
import Button from "../components/common/Button";
import ToggleSwitch from "../components/common/ToggleSwitch";
import PageHeader from "../components/PageHeader";
import { ICONS } from "../utils/icons";
import { filterInputCls } from "../components/common/FilterBar";
const TABS = ["General", "Notifications", "Security", "System"];
function splitName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1)
        return { first: parts[0] || "", last: "" };
    return { first: parts[0], last: parts.slice(1).join(" ") };
}
export default function Settings() {
    const { user, logout } = useAuth();
    const [isLoadingSettings, setIsLoadingSettings] = React.useState(true);
    const [settingsError, setSettingsError] = React.useState(null);
    const [successMessage, setSuccessMessage] = React.useState(null);
    const [profileForm, setProfileForm] = React.useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
    });
    const [notificationsForm, setNotificationsForm] = React.useState({
        notifications_email: false,
        notifications_in_app: false,
        notifications_maintenance_alerts: false,
        notifications_transfer_alerts: false,
        notifications_request_updates: false,
    });
    const [systemToggles, setSystemToggles] = React.useState({
        dark_mode: false,
        auto_backups: true,
    });
    const [systemForm, setSystemForm] = React.useState({
        organisation_name: "",
        asset_id_prefix: "",
        session_timeout_hours: 8,
        max_failed_login_attempts: 5,
    });
    const [isSavingGeneral, setIsSavingGeneral] = React.useState(false);
    const [isSavingNotifications, setIsSavingNotifications] = React.useState(false);
    const [isSavingSystem, setIsSavingSystem] = React.useState(false);
    const [generalError, setGeneralError] = React.useState(null);
    const [notificationsError, setNotificationsError] = React.useState(null);
    const [systemFormError, setSystemFormError] = React.useState(null);
    const [currentPassword, setCurrentPassword] = React.useState("");
    const [newPassword, setNewPassword] = React.useState("");
    const [confirmNewPassword, setConfirmNewPassword] = React.useState("");
    const [passwordError, setPasswordError] = React.useState(null);
    const [isChangingPassword, setIsChangingPassword] = React.useState(false);
    React.useEffect(() => {
        const loadSettings = async () => {
            setIsLoadingSettings(true);
            setSettingsError(null);
            try {
                const [userSettingsData, systemSettingsData] = await Promise.all([
                    apiFetch("/settings"),
                    user?.role === "System Administrator"
                        ? apiFetch("/settings/system")
                        : Promise.resolve(null),
                ]);
                const nameParts = splitName(user?.full_name || "Robert Ssekandi");
                setProfileForm({
                    firstName: nameParts.first,
                    lastName: nameParts.last,
                    email: user?.email || "admin@ursb.go.ug",
                    phone: "+256700000000",
                });
                if (userSettingsData) {
                    setNotificationsForm({
                        notifications_email: userSettingsData.notifications_email,
                        notifications_in_app: userSettingsData.notifications_in_app,
                        notifications_maintenance_alerts: userSettingsData.notifications_maintenance_alerts,
                        notifications_transfer_alerts: userSettingsData.notifications_transfer_alerts,
                        notifications_request_updates: userSettingsData.notifications_request_updates,
                    });
                    setSystemToggles({
                        dark_mode: userSettingsData.theme === "dark",
                        auto_backups: true,
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
                const message = err instanceof Error ? err.message : "Failed to load settings";
                setSettingsError(message);
            }
            finally {
                setIsLoadingSettings(false);
            }
        };
        loadSettings();
    }, [user?.role, user?.full_name, user?.email]);
    const handleGeneralSave = async () => {
        setGeneralError(null);
        setIsSavingGeneral(true);
        try {
            await apiFetch("/settings", {
                method: "PUT",
                body: JSON.stringify({
                    theme: systemToggles.dark_mode ? "dark" : "light",
                    language: "en",
                }),
            });
            setSuccessMessage("General settings saved.");
            setTimeout(() => setSuccessMessage(null), 5000);
        }
        catch (err) {
            setGeneralError(err instanceof Error ? err.message : "Failed to save general settings");
        }
        finally {
            setIsSavingGeneral(false);
        }
    };
    const handleNotificationsSave = async () => {
        setNotificationsError(null);
        setIsSavingNotifications(true);
        try {
            await apiFetch("/settings", { method: "PUT", body: JSON.stringify(notificationsForm) });
            setSuccessMessage("Notification preferences saved.");
            setTimeout(() => setSuccessMessage(null), 5000);
        }
        catch (err) {
            setNotificationsError(err instanceof Error ? err.message : "Failed to save notification preferences");
        }
        finally {
            setIsSavingNotifications(false);
        }
    };
    const handleSystemSave = async () => {
        setSystemFormError(null);
        setIsSavingSystem(true);
        try {
            if (user?.role === "System Administrator") {
                await apiFetch("/settings/system", { method: "PUT", body: JSON.stringify(systemForm) });
            }
            setSuccessMessage("System settings saved.");
            setTimeout(() => setSuccessMessage(null), 5000);
        }
        catch (err) {
            setSystemFormError(err instanceof Error ? err.message : "Failed to save system settings");
        }
        finally {
            setIsSavingSystem(false);
        }
    };
    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPasswordError(null);
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
            await apiFetch("/auth/password", {
                method: "PUT",
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                    confirm_new_password: confirmNewPassword,
                }),
            });
            sessionStorage.setItem("post_auth_message", "Your password has been changed. Please log in with your new password.");
            await logout();
        }
        catch (err) {
            setPasswordError(err instanceof Error ? err.message : "Password change failed.");
        }
        finally {
            setIsChangingPassword(false);
        }
    };
    const ToggleRow = ({ label, description, checked, onChange, }) => (_jsxs("div", { className: "flex items-center justify-between gap-4 py-4 border-b border-sky-page/30 last:border-b-0", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[10px] font-bold uppercase tracking-wider text-ink-dim", children: label }), _jsx("div", { className: "text-sm text-ink mt-1", children: description })] }), _jsx(ToggleSwitch, { checked: checked, onChange: onChange })] }));
    return (_jsxs("div", { className: "w-full flex flex-col gap-5 select-none font-sans", children: [successMessage && _jsx(SuccessBanner, { message: successMessage, onDismiss: () => setSuccessMessage(null) }), settingsError && _jsx(ErrorMessage, { message: settingsError }), _jsx(PageHeader, { title: "Settings", subtitle: "Configure your account and system preferences" }), isLoadingSettings && (_jsxs("div", { className: "flex items-center gap-2 text-sm text-ink-dim", children: [_jsx(LoadingSpinner, {}), " Loading settings..."] })), _jsxs(Tab.Group, { children: [_jsx(Tab.List, { className: "flex flex-wrap gap-1.5 p-1.5 bg-white border border-sky-cardBorder rounded-xl w-fit", children: TABS.map((tab) => (_jsx(Tab, { as: Fragment, children: ({ selected, ...tabProps }) => (_jsx(Button, { ...tabProps, type: "button", variant: selected ? "primary" : "ghost", className: selected ? "" : "shadow-none border-transparent bg-transparent", children: tab })) }, tab))) }), _jsxs(Tab.Panels, { className: "mt-2", children: [_jsxs(Tab.Panel, { className: "bg-white border border-sky-cardBorder rounded-2xl p-8 sm:p-10 shadow-sm focus:outline-none", children: [_jsx("h3", { className: "font-bold text-base text-ink", children: "Profile" }), _jsx("p", { className: "text-sm text-ink-dim mt-1 mb-6", children: "Update your personal details." }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6", children: [
                                            { id: "first-name", label: "First name", key: "firstName" },
                                            { id: "last-name", label: "Last name", key: "lastName" },
                                            { id: "email", label: "Email address", key: "email" },
                                            { id: "phone", label: "Phone number", key: "phone" },
                                        ].map((field) => (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("label", { htmlFor: field.id, className: "text-[10px] font-bold uppercase tracking-wider text-ink-dim", children: field.label }), _jsx("input", { id: field.id, className: filterInputCls, value: profileForm[field.key], onChange: (e) => setProfileForm({ ...profileForm, [field.key]: e.target.value }) })] }, field.id))) }), generalError && _jsx("div", { className: "mt-4", children: _jsx(ErrorMessage, { message: generalError }) }), _jsx("div", { className: "flex justify-end pt-6 mt-6 border-t border-sky-page/30", children: _jsx(Button, { onClick: handleGeneralSave, isLoading: isSavingGeneral, children: "Save Changes" }) })] }), _jsxs(Tab.Panel, { className: "bg-white border border-sky-cardBorder rounded-2xl p-8 sm:p-10 shadow-sm focus:outline-none", children: [_jsx("h3", { className: "font-bold text-base text-ink", children: "Notification Preferences" }), _jsxs("div", { className: "mt-6", children: [_jsx(ToggleRow, { label: "Email Notifications", description: "Receive email alerts for important events", checked: notificationsForm.notifications_email, onChange: (v) => setNotificationsForm({ ...notificationsForm, notifications_email: v }) }), _jsx(ToggleRow, { label: "In-App Notifications", description: "Receive in-app notifications", checked: notificationsForm.notifications_in_app, onChange: (v) => setNotificationsForm({ ...notificationsForm, notifications_in_app: v }) }), _jsx(ToggleRow, { label: "Maintenance Alerts", description: "Alert when assets are due for maintenance", checked: notificationsForm.notifications_maintenance_alerts, onChange: (v) => setNotificationsForm({ ...notificationsForm, notifications_maintenance_alerts: v }) }), _jsx(ToggleRow, { label: "Transfer Alerts", description: "Notify when a new asset transfer is requested", checked: notificationsForm.notifications_transfer_alerts, onChange: (v) => setNotificationsForm({ ...notificationsForm, notifications_transfer_alerts: v }) }), _jsx(ToggleRow, { label: "Request Updates", description: "Notify about asset request status updates", checked: notificationsForm.notifications_request_updates, onChange: (v) => setNotificationsForm({ ...notificationsForm, notifications_request_updates: v }) })] }), notificationsError && _jsx("div", { className: "mt-4", children: _jsx(ErrorMessage, { message: notificationsError }) }), _jsx("div", { className: "flex justify-end pt-6 mt-6 border-t border-sky-page/30", children: _jsx(Button, { onClick: handleNotificationsSave, isLoading: isSavingNotifications, children: "Save Changes" }) })] }), _jsxs(Tab.Panel, { className: "bg-white border border-sky-cardBorder rounded-2xl p-8 sm:p-10 shadow-sm focus:outline-none", children: [_jsx("h3", { className: "font-bold text-base text-ink", children: "Change Password" }), _jsx("p", { className: "text-sm text-ink-dim mt-1 mb-6", children: "Use at least 8 characters, including a number and a special character." }), passwordError && _jsx(ErrorMessage, { message: passwordError }), _jsxs("form", { onSubmit: handlePasswordChange, className: "grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 max-w-3xl", children: [_jsxs("div", { className: "flex flex-col gap-2 md:col-span-2", children: [_jsx("label", { htmlFor: "current-password", className: "text-[10px] font-bold uppercase tracking-wider text-ink-dim", children: "Current password" }), _jsx("input", { id: "current-password", type: "password", className: filterInputCls, value: currentPassword, onChange: (e) => setCurrentPassword(e.target.value), required: true })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("label", { htmlFor: "new-password", className: "text-[10px] font-bold uppercase tracking-wider text-ink-dim", children: "New password" }), _jsx("input", { id: "new-password", type: "password", className: filterInputCls, value: newPassword, onChange: (e) => setNewPassword(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", required: true })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("label", { htmlFor: "confirm-password", className: "text-[10px] font-bold uppercase tracking-wider text-ink-dim", children: "Confirm password" }), _jsx("input", { id: "confirm-password", type: "password", className: filterInputCls, value: confirmNewPassword, onChange: (e) => setConfirmNewPassword(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", required: true })] }), _jsx("div", { className: "md:col-span-2 flex justify-end pt-2", children: _jsx(Button, { type: "submit", isLoading: isChangingPassword, children: "Update Password" }) })] })] }), _jsxs(Tab.Panel, { className: "bg-white border border-sky-cardBorder rounded-2xl p-8 sm:p-10 shadow-sm focus:outline-none", children: [_jsx("h3", { className: "font-bold text-base text-ink", children: "System" }), _jsxs("div", { className: "mt-6", children: [_jsx(ToggleRow, { label: "Dark Mode", description: "Switch the interface to a dark theme", checked: systemToggles.dark_mode, onChange: (v) => setSystemToggles({ ...systemToggles, dark_mode: v }) }), _jsx(ToggleRow, { label: "Auto Backups", description: "Automatically back up asset data weekly", checked: systemToggles.auto_backups, onChange: (v) => setSystemToggles({ ...systemToggles, auto_backups: v }) })] }), user?.role === "System Administrator" && (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 mt-8 pt-6 border-t border-sky-page/30", children: [
                                            { label: "Organisation Name", key: "organisation_name", type: "text" },
                                            { label: "Asset ID Prefix", key: "asset_id_prefix", type: "text" },
                                        ].map((field) => (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-wider text-ink-dim", children: field.label }), _jsx("input", { className: filterInputCls, value: systemForm[field.key], onChange: (e) => setSystemForm({ ...systemForm, [field.key]: e.target.value }) })] }, field.key))) })), systemFormError && _jsx("div", { className: "mt-4", children: _jsx(ErrorMessage, { message: systemFormError }) }), user?.role !== "System Administrator" ? (_jsx(EmptyState, { icon: _jsx(ICONS.settings, { className: "w-6 h-6 text-ink-icon stroke-[2.2]" }), title: "Advanced system settings", description: "Organisation-level settings are only available to System Administrators." })) : null, _jsx("div", { className: "flex justify-end pt-6 mt-6 border-t border-sky-page/30", children: _jsx(Button, { onClick: handleSystemSave, isLoading: isSavingSystem, children: "Save Changes" }) })] })] })] })] }));
}
