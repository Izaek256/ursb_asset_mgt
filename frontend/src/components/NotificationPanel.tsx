import React from "react";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "info" | "warning" | "success";
}

const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    title: "Maintenance Due",
    message: "3 assets are due for scheduled maintenance this week.",
    time: "2 hours ago",
    read: false,
    type: "warning",
  },
  {
    id: "2",
    title: "New Asset Registered",
    message: "Dell Latitude 5540 Laptop has been added to ICT Equipment.",
    time: "5 hours ago",
    read: false,
    type: "success",
  },
  {
    id: "3",
    title: "Role Change Completed",
    message: "John Mukasa's role was updated to Asset Custodian.",
    time: "1 day ago",
    read: true,
    type: "info",
  },
  {
    id: "4",
    title: "Disposal Approved",
    message: "Write-off for Dell OptiPlex 390 has been approved.",
    time: "2 days ago",
    read: true,
    type: "info",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NotificationPanel({ open, onClose }: Props) {
  const [items, setItems] = React.useState(SAMPLE_NOTIFICATIONS);

  if (!open) return null;

  const unread = items.filter((n) => !n.read).length;

  const markAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const typeIcon: Record<string, string> = {
    info: "ℹ️",
    warning: "⚠️",
    success: "✅",
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
          {items.map((n) => (
            <div key={n.id} className={`notif-item ${n.read ? "read" : "unread"}`}>
              <span className="notif-icon">{typeIcon[n.type]}</span>
              <div className="notif-content">
                <div className="notif-title">{n.title}</div>
                <div className="notif-msg">{n.message}</div>
                <div className="notif-time">{n.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
