import { useState, useEffect } from "react";
import { Logo } from "../atoms/Logo";
import { NavLink } from "../atoms/NavLink";
import { MobileMenu } from "../molecules/MobileMenu";
import { Button } from "../ui/button";

export interface NavItem {
  label: string;
  href: string;
}

const DEFAULT_NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "About", href: "/#about" },
];

interface HeaderProps {
  onSignIn: () => void;
  onRegister: () => void;
  navItems?: NavItem[];
}

export function Header({ onSignIn, onRegister, navItems = DEFAULT_NAV }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      role="banner"
      className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-[#E0E0E0] transition-shadow duration-300"
      style={{ boxShadow: scrolled ? "0px 2px 4px rgba(0,0,0,0.08)" : "none" }}
    >
      <div className="mx-auto h-full max-w-[1200px] px-16 flex items-center justify-between gap-6">
        {/* Logo */}
        <Logo size="md" href="/" />

        {/* Desktop nav — centered */}
        <nav
          role="navigation"
          aria-label="Main navigation"
          className="hidden md:flex items-center gap-8 flex-1 justify-center"
        >
          {navItems.map((item) => (
            <NavLink key={item.label} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop auth actions */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={onSignIn}
            className="text-sm font-medium leading-5 text-[#1A73E8] hover:text-[#1557B0] hover:underline underline-offset-2 transition-colors duration-200 px-2 min-h-[44px] flex items-center"
            aria-label="Sign in to your account"
          >
            Sign In
          </button>

          <Button
            variant="default"
            size="default"
            onClick={onRegister}
            className="bg-[#1A73E8] text-white hover:bg-[#1557B0] active:bg-[#0D47A1] focus-visible:ring-[rgba(26,115,232,0.4)] min-h-[44px]"
            style={{ boxShadow: "0px 2px 4px rgba(0,0,0,0.1)" }}
            aria-label="Register a new account"
          >
            Register
          </Button>
        </div>

        {/* Mobile hamburger */}
        <MobileMenu navItems={navItems} onSignIn={onSignIn} onRegister={onRegister} />
      </div>
    </header>
  );
}
