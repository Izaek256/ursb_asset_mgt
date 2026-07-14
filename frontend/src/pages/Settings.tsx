import React, { Fragment } from "react";
import { Tab } from "@headlessui/react";
import { useAuth } from "../AuthContext";
import { apiFetch } from "../AuthContext";
import { UserSettings, SystemSettings } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import SuccessBanner from "../components/common/SuccessBanner";
import Button from "../components/common/Button";
import ToggleSwitch from "../components/common/ToggleSwitch";
import PageHeader from "../components/PageHeader";
import { filterInputCls } from "../components/common/FilterBar";

const TABS = ["General", "Notifications", "Security", "System"] as const;

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { first: parts[0] || "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export default function Settings() {
  const { user, refreshUser } = useAuth();
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

  const [darkMode, setDarkMode] = React.useState(false);

  // System settings form — uses backend field names to avoid mapping bugs
  const [systemForm, setSystemForm] = React.useState({
    org_name: "",
    asset_id_prefix: "",
    session_timeout_hours: 8,
    max_failed_logins: 5,
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

  const isAdmin = user?.role === "System Administrator";

  React.useEffect(() => {
    const loadSettings = async () => {
      setIsLoadingSettings(true);
      setSettingsError(null);
      try {
        const [userSettingsData, systemSettingsData] = await Promise.all([
          apiFetch<UserSettings>("/settings"),
          isAdmin
            ? apiFetch<SystemSettings>("/settings/system")
            : Promise.resolve(null),
        ]);

        const nameParts = splitName(user?.full_name || "");
        setProfileForm({
          firstName: nameParts.first,
          lastName: nameParts.last,
          email: user?.email || "",
          phone: user?.phone_number || "",
        });

        if (userSettingsData) {
          setNotificationsForm({
            notifications_email: userSettingsData.notifications_email,
            notifications_in_app: userSettingsData.notifications_in_app,
            notifications_maintenance_alerts: userSettingsData.notifications_maintenance_alerts,
            notifications_transfer_alerts: userSettingsData.notifications_transfer_alerts,
            notifications_request_updates: userSettingsData.notifications_request_updates,
          });
          setDarkMode(userSettingsData.theme === "dark");
        }

        if (systemSettingsData) {
          setSystemForm({
            org_name: systemSettingsData.org_name,
            asset_id_prefix: systemSettingsData.asset_id_prefix,
            session_timeout_hours: systemSettingsData.session_timeout_hours,
            max_failed_logins: systemSettingsData.max_failed_logins,
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
  }, [user?.role, user?.full_name, user?.email, user?.phone_number, isAdmin]);

  // ── General (profile) save ─────────────────────────────────────────────────
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
          language: "en",
        }),
      });
      // Refresh the global user state so the sidebar, header, etc. update immediately
      await refreshUser();
      setSuccessMessage("Profile updated successfully.");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // ── Notifications save ─────────────────────────────────────────────────────
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

  // ── System save ────────────────────────────────────────────────────────────
  const handleSystemSave = async () => {
    setSystemFormError(null);
    setIsSavingSystem(true);
    try {
      // Always persist the theme preference (user-level setting)
      await apiFetch("/settings", {
        method: "PUT",
        body: JSON.stringify({
          theme: darkMode ? "dark" : "light",
        }),
      });

      // Persist organisation-level settings (admin only)
      if (isAdmin) {
        await apiFetch("/settings/system", {
          method: "PUT",
          body: JSON.stringify(systemForm),
        });
      }

      // Refresh user so dark-mode class is applied system-wide immediately
      await refreshUser();
      setSuccessMessage("System settings saved.");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      setSystemFormError(err instanceof Error ? err.message : "Failed to save system settings");
    } finally {
      setIsSavingSystem(false);
    }
  };

  // ── Password change ────────────────────────────────────────────────────────
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

  // ── Shared sub-components ──────────────────────────────────────────────────
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

  const FormField = ({
    id,
    label,
    children,
  }: {
    id?: string;
    label: string;
    children: React.ReactNode;
  }) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">
        {label}
      </label>
      {children}
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

          {/* ── General / Profile tab ────────────────────────────────────────── */}
          <Tab.Panel className="bg-white border border-sky-cardBorder rounded-2xl p-8 sm:p-10 shadow-sm focus:outline-none">
            <h3 className="font-bold text-base text-ink">Profile</h3>
            <p className="text-sm text-ink-dim mt-1 mb-6">Update your personal details. Your email address cannot be changed.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              <FormField id="first-name" label="First name">
                <input
                  id="first-name"
                  className={filterInputCls}
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                  placeholder="First name"
                />
              </FormField>

              <FormField id="last-name" label="Last name">
                <input
                  id="last-name"
                  className={filterInputCls}
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                  placeholder="Last name"
                />
              </FormField>

              <FormField id="phone" label="Phone number">
                <input
                  id="phone"
                  type="tel"
                  className={filterInputCls}
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="+256 700 000 000"
                />
              </FormField>

              <FormField id="email" label="Email address">
                <input
                  id="email"
                  type="email"
                  className={filterInputCls}
                  value={profileForm.email}
                  disabled
                  style={{ opacity: 0.6, cursor: "not-allowed" }}
                />
                <p className="text-[10px] text-ink-dim mt-0.5">Email is managed by your administrator and cannot be changed here.</p>
              </FormField>
            </div>
            {generalError && <div className="mt-4"><ErrorMessage message={generalError} /></div>}
            <div className="flex justify-end pt-6 mt-6 border-t border-sky-page/30">
              <Button onClick={handleGeneralSave} isLoading={isSavingGeneral}>Save Changes</Button>
            </div>
          </Tab.Panel>

          {/* ── Notifications tab ────────────────────────────────────────────── */}
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

          {/* ── Security tab ─────────────────────────────────────────────────── */}
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

          {/* ── System tab ───────────────────────────────────────────────────── */}
          <Tab.Panel className="bg-white border border-sky-cardBorder rounded-2xl p-8 sm:p-10 shadow-sm focus:outline-none">
            <h3 className="font-bold text-base text-ink">System</h3>
            <p className="text-sm text-ink-dim mt-1 mb-6">
              {isAdmin ? "Manage interface and organisation-wide system configuration." : "Manage your interface preferences."}
            </p>

            {/* Appearance */}
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-dim mb-1">Appearance</p>
              <ToggleRow
                label="Dark Mode"
                description="Switch the interface to a dark theme"
                checked={darkMode}
                onChange={setDarkMode}
              />
            </div>

            {/* Organisation settings — admin only */}
            {isAdmin && (
              <>
                <div className="pt-4 border-t border-sky-page/30">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-dim mb-4">Organisation Configuration</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                    <FormField id="org-name" label="Organisation Name">
                      <input
                        id="org-name"
                        className={filterInputCls}
                        value={systemForm.org_name}
                        onChange={(e) => setSystemForm({ ...systemForm, org_name: e.target.value })}
                        placeholder="Uganda Registration Services Bureau"
                      />
                    </FormField>

                    <FormField id="asset-prefix" label="Asset ID Prefix">
                      <input
                        id="asset-prefix"
                        className={filterInputCls}
                        value={systemForm.asset_id_prefix}
                        onChange={(e) => setSystemForm({ ...systemForm, asset_id_prefix: e.target.value.toUpperCase() })}
                        placeholder="AST"
                        maxLength={20}
                      />
                      <p className="text-[10px] text-ink-dim mt-0.5">Used as a prefix when generating new asset IDs (e.g. AST-A1B2C3).</p>
                    </FormField>

                    <FormField id="session-timeout" label="Session Timeout (hours)">
                      <input
                        id="session-timeout"
                        type="number"
                        min={1}
                        max={168}
                        className={filterInputCls}
                        value={systemForm.session_timeout_hours}
                        onChange={(e) => setSystemForm({ ...systemForm, session_timeout_hours: parseInt(e.target.value, 10) || 8 })}
                      />
                      <p className="text-[10px] text-ink-dim mt-0.5">Between 1 and 168 hours (1 week).</p>
                    </FormField>

                    <FormField id="max-failed-logins" label="Max Failed Login Attempts">
                      <input
                        id="max-failed-logins"
                        type="number"
                        min={1}
                        max={10}
                        className={filterInputCls}
                        value={systemForm.max_failed_logins}
                        onChange={(e) => setSystemForm({ ...systemForm, max_failed_logins: parseInt(e.target.value, 10) || 5 })}
                      />
                      <p className="text-[10px] text-ink-dim mt-0.5">Between 1 and 10 attempts before account lock.</p>
                    </FormField>
                  </div>
                </div>
              </>
            )}

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
