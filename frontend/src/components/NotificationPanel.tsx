import React from "react";
import { apiFetch } from "../AuthContext";

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

interface Props {
  open: boolean;
  onClose: () => void;
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

export default function NotificationPanel({ open, onClose }: Props) {
  const [items, setItems] = React.useState<Notification[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const fetchNotifications = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<Notification[]>("/notifications");
      setItems(data);
    } catch (err) {
      console.error("Failed to load notifications.", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  if (!open) return null;

  const unread = items.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" });
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark all as read.", err);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark notification as read.", err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "ASSIGNMENT_SENT":
        return "📋";
      case "ASSET_APPROVED_PICKUP":
        return "📦";
      case "ASSET_READY_PICKUP":
        return "🚚";
      case "REQUEST_APPROVED":
        return "✅";
      case "REQUEST_SUBMITTED":
        return "📩";
      case "REQUEST_CANCELLED":
        return "❌";
      case "RECEIPT_CONFIRMED":
        return "🎉";
      case "PICKUP_CONFIRMED":
        return "✅";
      case "RETURN_REQUESTED":
        return "↩️";
      case "RETURN_APPROVED":
        return "✅";
      case "RETURN_REJECTED":
        return "❌";
      case "RETURN_COMPLETED":
        return "📥";
      default:
        return "ℹ️";
    }
  };

  return (
    <div className="notif-overlay" onClick={onClose}>
      <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
        <div className="notif-header">
          <h3>Notifications {unread > 0 && <span className="notif-badge">{unread}</span>}</h3>
          {unread > 0 && (
            <button className="notif-mark-read" onClick={markAllRead}>
              Mark all read
            </button>
          )}
        </div>
        <div className="notif-list">
          {isLoading && items.length === 0 ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ursb" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-xs text-ink-dim py-8">No notifications found</div>
          ) : (
            items.map((n) => (
              <div
                key={n.notification_id}
                className={`notif-item ${n.is_read ? "read" : "unread"} cursor-pointer transition-all duration-200 border-l-4 ${
                  !n.is_read ? "border-l-ursb font-semibold" : "border-l-transparent"
                }`}
                onClick={() => handleMarkAsRead(n.notification_id)}
              >
                <span className="notif-icon">{getIcon(n.notification_type)}</span>
                <div className="notif-content">
                  <div className={`notif-title ${!n.is_read ? "font-bold text-ursb" : "text-ink"}`}>
                    {n.title}
                  </div>
                  <div className="notif-msg text-xs mt-1 text-ink-dim">{n.message}</div>
                  <div className="notif-time text-[10px] text-ink-dim/60 mt-1">{timeAgo(n.created_at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
