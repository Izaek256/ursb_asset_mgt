import React from "react";
import { Popover, Transition } from "@headlessui/react";
import { ICONS } from "../utils/icons";
import Button from "./common/Button";

interface HeaderProps {
  pageTitle: string;
  onLogout: () => void;
  onToggleMobileSidebar?: () => void;
}

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
];

export default function Header({ pageTitle, onLogout, onToggleMobileSidebar }: HeaderProps) {
  const [notifications, setNotifications] = React.useState(SAMPLE_NOTIFICATIONS);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const getNotifTypeColor = (type: string) => {
    switch (type) {
      case "warning":
        return "text-badge-amberText bg-badge-amberBg";
      case "success":
        return "text-badge-greenText bg-badge-greenBg";
      default:
        return "text-badge-blueText bg-badge-blueBg";
    }
  };

  const getNotifTypeIcon = (type: string) => {
    switch (type) {
      case "warning":
        return ICONS.alertCircle;
      case "success":
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


        <Popover className="relative">
          {() => (
            <>
              <Popover.Button
                className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white text-ink-dim border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ursb/30"
                title="Notifications"
                aria-label="Notifications"
              >
                <ICONS.bell className="w-4 h-4 stroke-[2.4]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-badge-roseText border border-white animate-pulse motion-reduce:animate-none" />
                )}
              </Popover.Button>

              <Transition
                as={React.Fragment}
                enter="transition ease-out duration-200 motion-reduce:transition-none"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-150 motion-reduce:transition-none"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <Popover.Panel className="absolute right-0 z-50 mt-3 w-80 transform">
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
                      {notifications.map((n) => {
                        const NotifIcon = getNotifTypeIcon(n.type);
                        return (
                          <div
                            key={n.id}
                            className={`flex gap-3 p-2.5 rounded-xl border transition-colors ${
                              n.read ? "bg-transparent border-transparent" : "bg-sky-page/10 border-sky-border/20"
                            }`}
                          >
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getNotifTypeColor(n.type)}`}>
                              <NotifIcon className="w-4 h-4 stroke-[2.2]" />
                            </span>
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className="font-semibold text-xs text-ink truncate">{n.title}</span>
                              <p className="text-[11px] text-ink-dim leading-normal break-words">{n.message}</p>
                              <span className="text-[9px] text-ink-dim/60 font-semibold mt-0.5">{n.time}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>

        <Button variant="danger-inverse" onClick={onLogout}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
