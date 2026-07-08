import React from "react";
import { ICONS } from "../utils/icons";
import Button from "./common/Button";
import { apiFetch } from "../AuthContext";

interface HeaderProps {
  pageTitle: string;
  onLogout: () => void;
  onToggleMobileSidebar?: () => void;
}

interface Notification {
  notification_id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
  related_asset_id: string | null;
}

const timeAgo = (dateStr: string) => {
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 1) return `${diffDay} days ago`;
  if (diffDay === 1) return "1 day ago";
  if (diffHr > 1) return `${diffHr} hours ago`;
  if (diffHr === 1) return "1 hour ago";
  if (diffMin > 1) return `${diffMin} minutes ago`;
  if (diffMin === 1) return "1 minute ago";
  return "just now";
};

export default function Header({ pageTitle, onLogout, onToggleMobileSidebar }: HeaderProps) {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isOpen, setIsOpen] = React.useState(false);

  const fetchUnreadCount = React.useCallback(async () => {
    try {
      const data = await apiFetch<{ count: number }>("/notifications/unread-count");
      setUnreadCount(data.count);
    } catch (err) {
      console.error("Failed to fetch unread count", err);
    }
  }, []);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const data = await apiFetch<Notification[]>("/notifications");
      setNotifications(data);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  }, []);

  React.useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleMarkAllRead = async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" });
      fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error("Failed to mark all read", err);
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
      fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const getNotifTypeColor = (type: string) => {
    switch (type) {
      case "ASSIGNMENT_SENT":
        return "text-badge-amberText bg-badge-amberBg";
      case "REQUEST_APPROVED":
        return "text-badge-greenText bg-badge-greenBg";
      default:
        return "text-badge-blueText bg-badge-blueBg";
    }
  };

  const getNotifTypeIcon = (type: string) => {
    switch (type) {
      case "ASSIGNMENT_SENT":
        return ICONS.alertCircle;
      case "REQUEST_APPROVED":
        return ICONS.checkCircle;
      default:
        return ICONS.assets;
    }
  };

  return (
    <header className="sticky top-0 z-30 shrink-0 flex items-center justify-between px-5 sm:px-8 py-5 bg-sky-topbar/95 backdrop-blur-sm border-b border-sky-cardBorder select-none">
      <div className="flex items-center select-none min-w-0">
        {onToggleMobileSidebar && (
          <Button
            variant="icon"
            className="md:hidden mr-3"
            onClick={onToggleMobileSidebar}
            title="Open Menu"
            aria-label="Open menu"
          >
            <ICONS.menu className="w-5 h-5 stroke-[2.4]" />
          </Button>
        )}
        <div className="flex flex-col min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-ink leading-tight truncate">{pageTitle}</h1>
          <div className="flex items-center gap-1.5 text-xs text-ink-dim mt-1 pointer-events-none">
            <span>Home</span>
            <span className="opacity-40">/</span>
            <span className="font-semibold text-ursb truncate">{pageTitle}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">


        <div className="relative">
          <button
            onClick={() => {
              if (!isOpen) {
                fetchNotifications();
              }
              setIsOpen(!isOpen);
            }}
            className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white text-ink-dim border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ursb/30"
            title="Notifications"
            aria-label="Notifications"
          >
            <ICONS.bell className="w-4 h-4 stroke-[2.4]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-badge-roseBg text-badge-roseText text-[10px] font-bold border border-white animate-pulse motion-reduce:animate-none">
                {unreadCount}
              </span>
            )}
          </button>

          {isOpen && (
            <>
              {/* Transparent background overlay to dismiss the popup when clicking anywhere else */}
              <div 
                className="fixed inset-0 z-40 bg-transparent cursor-default" 
                onClick={() => setIsOpen(false)} 
              />
              <div className="absolute right-0 z-50 mt-3 w-80 transform">
                <div className="overflow-hidden rounded-2xl shadow-xl bg-white border border-sky-cardBorder p-4">
                  <div className="flex items-center justify-between border-b border-sky-page/20 pb-3 mb-3">
                    <span className="font-bold text-sm text-ink flex items-center gap-1.5">
                      Notifications
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-badge-roseBg text-badge-roseText">
                          {unreadCount}
                        </span>
                      )}
                    </span>
                    {unreadCount > 0 && (
                      <Button variant="ghost" className="py-1 px-2 text-xs text-ursb" onClick={handleMarkAllRead}>
                        Mark all read
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <div className="text-center text-xs text-ink-dim py-4">No notifications</div>
                    ) : (
                      notifications.map((n) => {
                        const NotifIcon = getNotifTypeIcon(n.notification_type);
                        return (
                          <div
                            key={n.notification_id}
                            className={`flex gap-3 p-2.5 rounded-xl border transition-colors cursor-pointer ${
                              n.is_read ? "bg-transparent border-transparent" : "bg-sky-page/10 border-sky-border/20"
                            }`}
                            onClick={() => {
                              handleMarkOneRead(n.notification_id);
                            }}
                          >
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getNotifTypeColor(n.notification_type)}`}>
                              <NotifIcon className="w-4 h-4 stroke-[2.2]" />
                            </span>
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className={`font-semibold text-xs text-ink truncate ${!n.is_read ? "font-bold text-ursb" : ""}`}>{n.title}</span>
                              <p className="text-[11px] text-ink-dim leading-normal break-words">{n.message}</p>
                              <span className="text-[9px] text-ink-dim/60 font-semibold mt-0.5">{timeAgo(n.created_at)}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <Button variant="danger-inverse" onClick={onLogout}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
