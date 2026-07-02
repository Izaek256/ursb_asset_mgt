import { useAuth } from "../AuthContext";
import { ICONS } from "../utils/icons";
import Button from "./common/Button";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activePath: string;
  onNavigate: (path: string) => void;
}

const ALL_ROLES = [
  "System Administrator",
  "Asset Manager",
  "Asset Custodian",
  "Employee",
];

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: ICONS.dashboard, path: "/dashboard", roles: ALL_ROLES },
  { id: "requests", label: "Requests", icon: ICONS.requests, path: "/requests", roles: ALL_ROLES },
  { id: "assets", label: "Assets", icon: ICONS.assets, path: "/assets", roles: ["System Administrator", "Asset Manager", "Asset Custodian"] },
  { id: "assignments", label: "Assignments", icon: ICONS.assignments, path: "/assignments", roles: ["System Administrator", "Asset Manager"] },
  { id: "storage", label: "Storage", icon: ICONS.storage, path: "/storage", roles: ["System Administrator", "Asset Manager"] },
  { id: "transfers", label: "Transfers", icon: ICONS.transfers, path: "/transfers", roles: ["System Administrator", "Asset Manager"] },
  { id: "maintenance", label: "Maintenance", icon: ICONS.maintenance, path: "/maintenance", roles: ["System Administrator", "Asset Manager"] },
  { id: "users", label: "User Management", icon: ICONS.users, path: "/admin/users", roles: ["System Administrator", "Asset Manager"] },
  { id: "audit", label: "Audit Logs", icon: ICONS.audit, path: "/admin/audit-logs", roles: ["System Administrator", "Asset Manager"] },
  { id: "settings", label: "Settings", icon: ICONS.settings, path: "/settings", roles: ["System Administrator"] },
];

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  activePath,
  onNavigate,
}: SidebarProps) {
  const { user } = useAuth();

  const userInitials = user
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "RS";

  const visibleNav = NAV_ITEMS.filter((n) =>
    n.roles.some((r) => user?.role?.toLowerCase().includes(r.toLowerCase()))
  );

  return (
    <aside
      className={`fixed md:sticky top-0 left-0 h-screen z-40 flex flex-col bg-gradient-to-b from-sky-sidebarTop to-sky-sidebarBot border-r border-sky-border py-5 px-3 transition-all duration-350 ease-in-out shrink-0 select-none motion-reduce:transition-none ${
        collapsed ? "w-20" : "w-[250px]"
      }`}
    >
      <div className="flex items-center gap-2.5 px-2 pb-5 select-none">
        <div className="w-10 h-10 min-w-10 rounded-xl bg-gradient-to-br from-ursb to-ursb-dark flex items-center justify-center text-white font-bold text-base shadow-lg shadow-ursb/35 pointer-events-none">
          U
        </div>
        <div
          className={`flex flex-col overflow-hidden whitespace-nowrap transition-all duration-200 motion-reduce:transition-none ${
            collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          }`}
        >
          <span className="font-bold text-sm text-ink leading-tight">URSB Assets</span>
          <span className="text-[11px] text-ink-dim font-medium mt-0.5">Management Portal</span>
        </div>
      </div>

      <div
        className={`text-[10px] font-bold tracking-widest text-ink-dim uppercase mx-2.5 my-2 transition-opacity duration-200 select-none ${
          collapsed ? "opacity-0 h-0 my-0 overflow-hidden" : "opacity-100"
        }`}
      >
        Main Menu
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto px-1 select-none scrollbar-thin scrollbar-thumb-sky-border/30 scrollbar-track-transparent">
        {visibleNav.map((item) => {
          const isActive =
            activePath === item.path ||
            (item.path !== "/dashboard" && activePath.startsWith(item.path));
          const Icon = item.icon;
          return (
            <Button
              key={item.id}
              variant="nav"
              active={isActive}
              onClick={() => onNavigate(item.path)}
              className={collapsed ? "justify-center px-2.5" : ""}
            >
              <span
                className={`w-5 h-5 flex items-center justify-center shrink-0 ${
                  isActive ? "text-ursb" : "text-ink-icon"
                }`}
              >
                <Icon className="w-4 h-4 stroke-[2.2]" />
              </span>
              <span
                className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${
                  collapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
                }`}
              >
                {item.label}
              </span>
            </Button>
          );
        })}
      </nav>

      <div className="select-none mt-auto">
        <div className="h-px bg-white/55 my-3 mx-1" />

        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/60 shadow-sm">
          <div className="w-9 h-9 min-w-9 rounded-full bg-gradient-to-br from-ursb to-ursb-dark text-white flex items-center justify-center text-xs font-bold pointer-events-none">
            {userInitials}
          </div>
          <div
            className={`flex flex-col overflow-hidden whitespace-nowrap transition-all duration-200 ${
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            }`}
          >
            <span className="text-xs font-bold text-ink leading-tight truncate max-w-36">
              {user?.full_name || "Robert Ssekandi"}
            </span>
            <span className="text-[10px] text-ink-dim font-medium mt-0.5 truncate max-w-36">
              {user?.role || "System Administrator"}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          fullWidth
          onClick={onToggleCollapse}
          className="mt-2.5 border-dashed justify-start gap-2 text-xs text-ink-dim"
        >
          <ICONS.chevronLeft
            className={`w-4 h-4 transition-transform duration-350 shrink-0 motion-reduce:transition-none ${
              collapsed ? "rotate-180" : ""
            }`}
          />
          <span className={collapsed ? "hidden" : ""}>Collapse</span>
        </Button>
      </div>
    </aside>
  );
}
