import { Twitter, Linkedin, Github, ChevronDown } from "lucide-react";
import { Logo } from "../atoms/Logo";

const QUICK_LINKS = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "About", href: "#about" },
];

const SUPPORT_LINKS = [
  { label: "Help Center", href: "#" },
  { label: "Contact Us", href: "#" },
  { label: "FAQ", href: "#" },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "Cookie Policy", href: "#" },
];

const SOCIAL_LINKS = [
  { icon: Twitter, label: "Twitter", href: "#" },
  { icon: Linkedin, label: "LinkedIn", href: "#" },
  { icon: Github, label: "GitHub", href: "#" },
];

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="block text-sm leading-5 transition-colors duration-200 py-1"
      style={{ color: "#9E9E9E", fontWeight: 400, fontSize: "14px" }}
      onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = "#1A73E8")}
      onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = "#9E9E9E")}
    >
      {children}
    </a>
  );
}

function FooterColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4
      className="mb-4"
      style={{
        color: "#212121",
        fontSize: "14px",
        fontWeight: 600,
        lineHeight: "20px",
        letterSpacing: "0.5px",
        textTransform: "uppercase",
      }}
    >
      {children}
    </h4>
  );
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className="w-full border-t border-[#E0E0E0] bg-[#F5F5F5]"
    >
      {/* Main footer body */}
      <div className="mx-auto max-w-[1200px] px-16 py-12">
        {/* Desktop: Logo top-left + 4 link columns */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-12">
          {/* Brand column */}
          <div className="md:col-span-1 flex flex-col gap-4">
            <Logo size="md" />
            <p
              className="max-w-[200px]"
              style={{
                color: "#9E9E9E",
                fontSize: "14px",
                lineHeight: "20px",
                fontWeight: 400,
              }}
            >
              Secure, scalable user authentication and management for modern teams.
            </p>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-1">
            <FooterColumnHeading>Quick Links</FooterColumnHeading>
            <nav aria-label="Quick links">
              {QUICK_LINKS.map((link) => (
                <FooterLink key={link.label} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
            </nav>
          </div>

          {/* Support */}
          <div className="md:col-span-1">
            <FooterColumnHeading>Support</FooterColumnHeading>
            <nav aria-label="Support links">
              {SUPPORT_LINKS.map((link) => (
                <FooterLink key={link.label} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
            </nav>
          </div>

          {/* Legal */}
          <div className="md:col-span-1">
            <FooterColumnHeading>Legal</FooterColumnHeading>
            <nav aria-label="Legal links">
              {LEGAL_LINKS.map((link) => (
                <FooterLink key={link.label} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
            </nav>
          </div>

          {/* Connect — social icons */}
          <div className="md:col-span-1">
            <FooterColumnHeading>Connect</FooterColumnHeading>
            <div className="flex flex-row md:flex-col gap-3">
              {SOCIAL_LINKS.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="inline-flex items-center gap-2 text-sm leading-5 transition-colors duration-200"
                  style={{ color: "#9E9E9E" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.color = "#1A73E8";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.color = "#9E9E9E";
                  }}
                >
                  <Icon size={20} />
                  <span className="hidden md:inline">{label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="border-t border-[#E0E0E0]"
        style={{ backgroundColor: "#EEEEEE" }}
      >
        <div className="mx-auto max-w-[1200px] px-16 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p
            style={{
              color: "#9E9E9E",
              fontSize: "12px",
              lineHeight: "16px",
              letterSpacing: "0.25px",
            }}
          >
            © {year} User Management System. All rights reserved.
          </p>

          {/* Language dropdown */}
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E0E0E0] bg-white text-xs font-medium text-[#9E9E9E] hover:border-[#1A73E8] hover:text-[#1A73E8] transition-colors duration-200 min-h-[36px]"
            aria-label="Select language"
          >
            🌐 English (US)
            <ChevronDown size={12} aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  );
}
