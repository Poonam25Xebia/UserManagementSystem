import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { LogOut, User, ChevronDown } from "lucide-react";
import { Logo } from "../atoms/Logo";
import { logoutUser } from "../../lib/api-client";
import { clearSession, getSessionToken } from "../../lib/session";

interface AuthHeaderProps {
  userName?: string;
  userEmail?: string;
}

export function AuthHeader({ userName = "Jane Smith", userEmail = "jane@example.com" }: AuthHeaderProps) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    setDropOpen(false);
    const token = getSessionToken();
    if (token) {
      try {
        await logoutUser(token);
      } catch {
        /* ignore — clear local session regardless of network outcome */
      }
    }
    clearSession();
    navigate("/login");
  };

  return (
    <header
      role="banner"
      className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-[#E0E0E0] transition-shadow duration-300"
      style={{ boxShadow: scrolled ? "0px 2px 4px rgba(0,0,0,0.08)" : "none" }}
    >
      <div className="h-full px-6 flex items-center justify-between gap-6">
        {/* Logo */}
        <Logo size="md" href="/dashboard" />

        {/* Center nav */}
        <nav role="navigation" aria-label="Dashboard navigation" className="hidden md:flex items-center gap-6">
          {[
            { label: "Dashboard", href: "/dashboard"         },
            { label: "Account",   href: "/account-dashboard" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm font-medium transition-colors duration-200 hover:underline underline-offset-2"
              style={{ color: "#1A73E8" }}
              onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = "#1557B0")}
              onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = "#1A73E8")}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Right — user avatar + dropdown */}
        <div className="relative flex items-center gap-3">
          {/* User avatar button */}
          <button
            onClick={() => setDropOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={dropOpen}
            aria-label="User menu"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#F5F5F5] transition-colors min-h-[44px]"
          >
            {/* Avatar circle */}
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold text-white flex-shrink-0"
              style={{ backgroundColor: "#1A73E8" }}
              aria-hidden="true"
            >
              {initials}
            </span>
            <span className="hidden sm:block text-sm font-medium text-[#212121] max-w-[120px] truncate">
              {userName}
            </span>
            <ChevronDown size={14} className="text-[#9E9E9E]" aria-hidden="true" />
          </button>

          {/* Logout button (always visible on desktop) */}
          <button
            onClick={handleLogout}
            className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-md border border-[#1A73E8] text-sm font-semibold text-[#1A73E8] hover:bg-[rgba(26,115,232,0.08)] hover:border-[#1557B0] hover:text-[#1557B0] transition-all min-h-[44px]"
            style={{ letterSpacing: "0.5px" }}
            aria-label="Log out"
          >
            <LogOut size={14} aria-hidden="true" />
            Logout
          </button>

          {/* Dropdown menu (mobile / avatar click) */}
          {dropOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropOpen(false)} aria-hidden="true" />
              <div
                className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-[#E0E0E0] bg-white z-50 overflow-hidden"
                style={{ boxShadow: "0px 8px 32px rgba(0,0,0,0.12)" }}
                role="menu"
              >
                {/* User info */}
                <div className="px-4 py-3 border-b border-[#E0E0E0]">
                  <p className="text-sm font-semibold text-[#212121] truncate">{userName}</p>
                  <p className="text-xs text-[#9E9E9E] truncate mt-0.5">{userEmail}</p>
                </div>
                {/* Menu items */}
                {[
                  { icon: User,   label: "Profile", href: "#" },
                ].map(({ icon: Icon, label, href }) => (
                  <a
                    key={label}
                    href={href}
                    role="menuitem"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#212121] hover:bg-[#F5F5F5] transition-colors"
                  >
                    <Icon size={14} style={{ color: "#9E9E9E" }} aria-hidden="true" />
                    {label}
                  </a>
                ))}
                <div className="h-px bg-[#E0E0E0]" />
                <button
                  role="menuitem"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#D32F2F] hover:bg-[#FFEBEE] transition-colors"
                >
                  <LogOut size={14} aria-hidden="true" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
