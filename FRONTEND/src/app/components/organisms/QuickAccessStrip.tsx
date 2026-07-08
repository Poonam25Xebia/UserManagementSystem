import { BarChart2, FileText, UserCircle, LifeBuoy, ArrowRight } from "lucide-react";

interface Tile {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  href: string;
}

const TILES: Tile[] = [
  {
    icon:      BarChart2,
    iconColor: "#1A73E8",
    iconBg:    "rgba(26,115,232,0.10)",
    label:     "Feature 1",
    href:      "#",
  },
  {
    icon:      FileText,
    iconColor: "#00897B",
    iconBg:    "rgba(0,137,123,0.10)",
    label:     "Feature 2",
    href:      "#",
  },
  {
    icon:      UserCircle,
    iconColor: "#FF6D00",
    iconBg:    "rgba(255,109,0,0.10)",
    label:     "Delete Account",
    href:      "/delete-account",
  },
  {
    icon:      LifeBuoy,
    iconColor: "#9C27B0",
    iconBg:    "rgba(156,39,176,0.10)",
    label:     "Help Center",
    href:      "#",
  },
];

export function QuickAccessStrip() {
  return (
    <section aria-labelledby="quick-strip-heading">
      <h2
        id="quick-strip-heading"
        className="mb-4"
        style={{ color: "#212121", fontSize: "18px", fontWeight: 600, lineHeight: "28px" }}
      >
        Quick Access
      </h2>

      {/* 4 equal-width tiles in a horizontal strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {TILES.map(({ icon: Icon, iconColor, iconBg, label, href }) => (
          <a
            key={label}
            href={href}
            className="group relative flex flex-col items-center gap-3 rounded-lg border border-[#E0E0E0] bg-white px-4 pt-6 pb-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(26,115,232,0.4)]"
            style={{ boxShadow: "0px 2px 8px rgba(0,0,0,0.06)", textDecoration: "none" }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.boxShadow   = "0px 4px 16px rgba(0,0,0,0.12)";
              el.style.transform   = "translateY(-2px)";
              el.style.borderColor = "#1A73E8";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.boxShadow   = "0px 2px 8px rgba(0,0,0,0.06)";
              el.style.transform   = "translateY(0)";
              el.style.borderColor = "#E0E0E0";
            }}
          >
            {/* Icon — centred at top */}
            <span
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl transition-transform duration-200 group-hover:scale-110"
              style={{ backgroundColor: iconBg, color: iconColor }}
              aria-hidden="true"
            >
              <Icon size={24} strokeWidth={1.75} />
            </span>

            {/* Label */}
            <p
              className="text-center"
              style={{ color: "#212121", fontSize: "14px", fontWeight: 600, lineHeight: "20px" }}
            >
              {label}
            </p>

            {/* [Go →] link — bottom-right */}
            <span
              className="absolute bottom-3 right-4 inline-flex items-center gap-0.5 text-xs font-medium text-[#1A73E8] group-hover:text-[#1557B0] transition-colors"
              aria-hidden="true"
            >
              Go
              <ArrowRight size={11} />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
