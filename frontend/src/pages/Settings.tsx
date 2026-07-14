import React, { Fragment } from "react";
import { Tab } from "@headlessui/react";
import { useAuth } from "../AuthContext";
import { apiFetch } from "../AuthContext";
import { UserSettings, SystemSettings } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import SuccessBanner from "../components/common/SuccessBanner";
import EmptyState from "../components/EmptyState";
import Button from "../components/common/Button";
import ToggleSwitch from "../components/common/ToggleSwitch";
import PageHeader from "../components/PageHeader";
import { ICONS } from "../utils/icons";
import { filterInputCls } from "../components/common/FilterBar";

const TABS = ["General", "Notifications", "Security", "System"] as const;

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { first: parts[0] || "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export default function Settings() {
  const { user } = useAuth();
  const [isLoadingSettings, setIsLoadingSettings] = React.useState(true);
  const [settingsError, setSettingsError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

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
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [notificationsError, setNotificationsError] = React.useState<string | null>(null);
  const [systemFormError, setSystemFormError] = React.useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmNewPassword, setConfirmNewPassword] = React.useState("");
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [passwordSuccess, setPasswordSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadSettings = async () => {
      setIsLoadingSettings(true);
      setSettingsError(null);
      try {
        const [userSettingsData, systemSettingsData] = await Promise.all([
          apiFetch<UserSettings>("/settings"),
          user?.role === "System Administrator"
            ? apiFetch<SystemSettings>("/settings/system")
            : Promise.resolve(null),
        ]);

        const nameParts = splitName(user?.full_name || "Robert Ssekandi");
        setProfileForm({
          firstName: nameParts.first,
          lastName: nameParts.last,
          email: user?.email || "admin@ursb.go.ug",
          phone: user?.phone_number || "+256700000000",
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
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load settings";
        setSettingsError(message);
      } finally {
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
          first_name: profileForm.firstName,
          last_name: profileForm.lastName,
          phone_number: profileForm.phone,
          theme: systemToggles.dark_mode ? "dark" : "light",
          language: "en",
        }),
      });
      setSuccessMessage("General settings saved.");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : "Failed to save general settings");
    } finally {
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
    } catch (err: unknown) {
      setNotificationsError(err instanceof Error ? err.message : "Failed to save notification preferences");
    } finally {
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
    } catch (err: unknown) {
      setSystemFormError(err instanceof Error ? err.message : "Failed to save system settings");
    } finally {
      setIsSavingSystem(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
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
      await apiFetch("/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_new_password: confirmNewPassword,
        }),
      });
      setPasswordSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setTimeout(() => setPasswordSuccess(null), 5000);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Password change failed.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const ToggleRow = ({
    label,
    description,
    checked,
    onChange,
  }: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-sky-page/30 last:border-b-0">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">{label}</div>
        <div className="text-sm text-ink mt-1">{description}</div>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-5 select-none font-sans">
      {successMessage && <SuccessBanner message={successMessage} onDismiss={() => setSuccessMessage(null)} />}
      {settingsError && <ErrorMessage message={settingsError} />}

      <PageHeader
        title="Settings"
        subtitle="Configure your account and system preferences"
      />

      {isLoadingSettings && (
        <div className="flex items-center gap-2 text-sm text-ink-dim">
          <LoadingSpinner /> Loading settings...
        </div>
      )}

      <Tab.Group>
        <Tab.List className="flex flex-wrap gap-1.5 p-1.5 bg-white border border-sky-cardBorder rounded-xl w-fit">
          {TABS.map((tab) => (
            <Tab key={tab} as={Fragment}>
              {({ selected, ...tabProps }) => (
                <Button
                  {...tabProps}
                  type="button"
                  variant={selected ? "primary" : "ghost"}
                  className={selected ? "outline-none" : "shadow-none border-transparent bg-transparent !text-[#6a94d4] hover:bg-[#f9f8f6] outline-none"}
                  style={{ outline: "none", boxShadow: "none", WebkitTapHighlightColor: "transparent" }}
                >
                  {tab}
                </Button>
              )}
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="mt-2">
          <Tab.Panel className="bg-white border border-sky-cardBorder rounded-2xl p-8 sm:p-10 shadow-sm focus:outline-none">
            <h3 className="font-bold text-base text-ink">Profile</h3>
            <p className="text-sm text-ink-dim mt-1 mb-6">Update your personal details.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {["first-name", "last-name", "phone"].map((fieldId) => {
                const fieldConfig = {
                  "first-name": { label: "First name", key: "firstName" as const },
                  "last-name": { label: "Last name", key: "lastName" as const },
                  "phone": { label: "Phone number", key: "phone" as const },
                }[fieldId];
                return (
                  <div key={fieldId} className="flex flex-col gap-2">
                    <label htmlFor={fieldId} className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">
                      {fieldConfig.label}
                    </label>
                    <input
                      id={fieldId}
                      className={filterInputCls}
                      value={profileForm[fieldConfig.key]}
                      onChange={(e) => setProfileForm({ ...profileForm, [fieldConfig.key]: e.target.value })}
                    />
                  </div>
                );
              })}
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">
                  Email address
                </label>
                <input
                  id="email"
                  className={filterInputCls}
                  value={profileForm.email}
                  disabled
                  style={{ backgroundColor: "#f5f5f5", cursor: "not-allowed" }}
                />
              </div>
            </div>
            {generalError && <div className="mt-4"><ErrorMessage message={generalError} /></div>}
            <div className="flex justify-end pt-6 mt-6 border-t border-sky-page/30">
              <Button onClick={handleGeneralSave} isLoading={isSavingGeneral}>Save Changes</Button>
            </div>
          </Tab.Panel>

          <Tab.Panel className="bg-white border border-sky-cardBorder rounded-2xl p-8 sm:p-10 shadow-sm focus:outline-none">
            <h3 className="font-bold text-base text-ink">Notification Preferences</h3>
            <div className="mt-6">
              <ToggleRow label="Email Notifications" description="Receive email alerts for important events" checked={notificationsForm.notifications_email} onChange={(v) => setNotificationsForm({ ...notificationsForm, notifications_email: v })} />
              <ToggleRow label="In-App Notifications" description="Receive in-app notifications" checked={notificationsForm.notifications_in_app} onChange={(v) => setNotificationsForm({ ...notificationsForm, notifications_in_app: v })} />
              <ToggleRow label="Maintenance Alerts" description="Alert when assets are due for maintenance" checked={notificationsForm.notifications_maintenance_alerts} onChange={(v) => setNotificationsForm({ ...notificationsForm, notifications_maintenance_alerts: v })} />
              <ToggleRow label="Transfer Alerts" description="Notify when a new asset transfer is requested" checked={notificationsForm.notifications_transfer_alerts} onChange={(v) => setNotificationsForm({ ...notificationsForm, notifications_transfer_alerts: v })} />
              <ToggleRow label="Request Updates" description="Notify about asset request status updates" checked={notificationsForm.notifications_request_updates} onChange={(v) => setNotificationsForm({ ...notificationsForm, notifications_request_updates: v })} />
            </div>
            {notificationsError && <div className="mt-4"><ErrorMessage message={notificationsError} /></div>}
            <div className="flex justify-end pt-6 mt-6 border-t border-sky-page/30">
              <Button onClick={handleNotificationsSave} isLoading={isSavingNotifications}>Save Changes</Button>
            </div>
          </Tab.Panel>

          <Tab.Panel className="bg-white border border-sky-cardBorder rounded-2xl p-8 sm:p-10 shadow-sm focus:outline-none">
            <h3 className="font-bold text-base text-ink">Change Password</h3>
            <p className="text-sm text-ink-dim mt-1 mb-6">Use at least 8 characters, including a number and a special character.</p>
            {passwordError && <ErrorMessage message={passwordError} />}
            {passwordSuccess && <SuccessBanner message={passwordSuccess} onDismiss={() => setPasswordSuccess(null)} />}
            <form onSubmit={handlePasswordChange} className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 max-w-3xl">
              <div className="flex flex-col gap-2 md:col-span-2">
                <label htmlFor="current-password" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">Current password</label>
                <input id="current-password" type="password" className={filterInputCls} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="new-password" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">New password</label>
                <input id="new-password" type="password" className={filterInputCls} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="confirm-password" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">Confirm new password</label>
                <input id="confirm-password" type="password" className={filterInputCls} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <div className="md:col-span-2 flex justify-end pt-2">
                <Button type="submit" isLoading={isChangingPassword}>Update Password</Button>
              </div>
            </form>
          </Tab.Panel>

          <Tab.Panel className="bg-white border border-sky-cardBorder rounded-2xl p-8 sm:p-10 shadow-sm focus:outline-none">
            <h3 className="font-bold text-base text-ink">System</h3>
            <div className="mt-6">
              <ToggleRow label="Dark Mode" description="Switch the interface to a dark theme" checked={systemToggles.dark_mode} onChange={(v) => setSystemToggles({ ...systemToggles, dark_mode: v })} />
            </div>
            {systemFormError && <div className="mt-4"><ErrorMessage message={systemFormError} /></div>}
            <div className="flex justify-end pt-6 mt-6 border-t border-sky-page/30">
              <Button onClick={handleSystemSave} isLoading={isSavingSystem}>Save Changes</Button>
            </div>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
