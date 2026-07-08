import { useNavigate } from "react-router";
import {
  LayoutDashboard, BarChart2, LineChart,
  Settings, UserCircle, LogOut,
} from "lucide-react";

interface SidebarItem {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
}

const NAV_ITEMS: SidebarItem[] = [
  { icon: LayoutDashboard, label: "Dashboard",      href: "/dashboard",      active: true },
  { icon: BarChart2,       label: "Reports",       href: "#" },
  { icon: LineChart,       label: "Analytics",     href: "#" },
  { icon: Settings,        label: "Settings",      href: "#" },
  { icon: UserCircle,      label: "Profile",       href: "#" },
];

interface DashboardSidebarProps {
  onLogout: () => void;
}

export function DashboardSidebar({ onLogout }: DashboardSidebarProps) {
  return (
    <aside
      aria-label="Dashboard navigation"
      className="fixed top-16 left-0 bottom-0 flex flex-col border-r border-[#E0E0E0] bg-white overflow-y-auto z-40"
      style={{ width: "220px" }}
    >
      {/* Nav links */}
      <nav className="flex flex-col gap-1 p-3 flex-1" role="navigation">
        {NAV_ITEMS.map(({ icon: Icon, label, href, active }) => (
          <a
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group min-h-[44px]"
            style={{
              backgroundColor: active ? "rgba(26,115,232,0.08)" : "transparent",
              color:           active ? "#1A73E8" : "#212121",
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#F5F5F5";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "transparent";
              }
            }}
          >
            {/* Active indicator bar */}
            <span
              className="absolute left-0 w-0.5 rounded-r h-6 transition-opacity duration-150"
              style={{
                backgroundColor: "#1A73E8",
                opacity: active ? 1 : 0,
              }}
              aria-hidden="true"
            />
            <Icon
              size={18}
              aria-hidden="true"
              style={{ color: active ? "#1A73E8" : "#9E9E9E", flexShrink: 0 }}
            />
            {label}
          </a>
        ))}
      </nav>

      {/* Divider */}
      <div className="h-px mx-3 bg-[#E0E0E0]" aria-hidden="true" />

      {/* Logout */}
      <div className="p-3">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#D32F2F] hover:bg-[#FFEBEE] transition-colors min-h-[44px]"
          aria-label="Log out of dashboard"
        >
          <LogOut size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          Logout
        </button>
      </div>
    </aside>
  );
}
