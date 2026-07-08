import { useState } from "react";
import { Menu, X } from "lucide-react";
import { NavLink } from "../atoms/NavLink";

interface NavItem {
  label: string;
  href: string;
}

interface MobileMenuProps {
  navItems: NavItem[];
  onSignIn: () => void;
  onRegister: () => void;
}

export function MobileMenu({ navItems, onSignIn, onRegister }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <div className="relative md:hidden">
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="flex items-center justify-center w-11 h-11 rounded-lg text-[#212121] hover:bg-[#F5F5F5] transition-colors"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={close}
            aria-hidden="true"
          />

          {/* Drawer */}
          <div
            id="mobile-nav"
            role="dialog"
            aria-label="Mobile navigation menu"
            className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-[#E0E0E0] bg-white z-50 overflow-hidden"
            style={{ boxShadow: "var(--shadow-modal)" }}
          >
            {/* Close row */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E0E0E0]">
              <span className="text-sm font-semibold text-[#212121]">Menu</span>
              <button
                onClick={close}
                aria-label="Close menu"
                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[#F5F5F5] transition-colors text-[#9E9E9E]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Navigation links */}
            <nav className="flex flex-col px-2 py-2" aria-label="Mobile navigation">
              {navItems.map((item) => (
                <NavLink
                  key={item.label}
                  href={item.href}
                  onClick={close}
                  className="px-3 py-3 rounded-md text-[#1A73E8] hover:bg-[rgba(26,115,232,0.08)] !text-[#1A73E8] hover:!text-[#1557B0] !no-underline hover:!no-underline block"
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Auth actions */}
            <div className="flex flex-col gap-2 px-4 py-3 border-t border-[#E0E0E0]">
              <button
                onClick={() => { close(); onSignIn(); }}
                className="w-full py-2.5 px-4 text-sm font-medium text-[#1A73E8] hover:text-[#1557B0] border border-[#1A73E8] hover:border-[#1557B0] hover:bg-[rgba(26,115,232,0.08)] rounded-md transition-all min-h-[44px]"
              >
                Sign In
              </button>
              <button
                onClick={() => { close(); onRegister(); }}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1A73E8] hover:bg-[#1557B0] active:bg-[#0D47A1] rounded-md transition-colors min-h-[44px]"
                style={{ boxShadow: "var(--shadow-btn)" }}
              >
                Register
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
