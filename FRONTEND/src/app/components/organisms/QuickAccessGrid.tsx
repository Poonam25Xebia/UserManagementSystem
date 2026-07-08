import { BarChart2, Settings, LineChart, LifeBuoy } from "lucide-react";

interface QuickCard {
  icon: React.ElementType;
  label: string;
  description: string;
  iconColor: string;
  iconBg: string;
  href: string;
}

const CARDS: QuickCard[] = [
  {
    icon:        BarChart2,
    label:       "Reports",
    description: "View and export data reports",
    iconColor:   "#1A73E8",
    iconBg:      "rgba(26,115,232,0.10)",
    href:        "#",
  },
  {
    icon:        Settings,
    label:       "Settings",
    description: "Manage your account settings",
    iconColor:   "#00897B",
    iconBg:      "rgba(0,137,123,0.10)",
    href:        "#",
  },
  {
    icon:        LineChart,
    label:       "Analytics",
    description: "Explore usage and performance",
    iconColor:   "#FF6D00",
    iconBg:      "rgba(255,109,0,0.10)",
    href:        "#",
  },
  {
    icon:        LifeBuoy,
    label:       "Support",
    description: "Get help and documentation",
    iconColor:   "#9C27B0",
    iconBg:      "rgba(156,39,176,0.10)",
    href:        "#",
  },
];

export function QuickAccessGrid() {
  return (
    <section aria-labelledby="quick-access-heading">
      <h2
        id="quick-access-heading"
        className="mb-4"
        style={{ color: "#212121", fontSize: "16px", fontWeight: 600, lineHeight: "24px" }}
      >
        Quick Access
      </h2>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {CARDS.map(({ icon: Icon, label, description, iconColor, iconBg, href }) => (
          <a
            key={label}
            href={href}
            className="group flex flex-col gap-3 rounded-lg border border-[#E0E0E0] bg-white p-5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(26,115,232,0.4)]"
            style={{ boxShadow: "0px 2px 8px rgba(0,0,0,0.06)", textDecoration: "none" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0px 4px 16px rgba(0,0,0,0.12)";
              (e.currentTarget as HTMLAnchorElement).style.transform  = "translateY(-2px)";
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "#1A73E8";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.boxShadow   = "0px 2px 8px rgba(0,0,0,0.06)";
              (e.currentTarget as HTMLAnchorElement).style.transform    = "translateY(0)";
              (e.currentTarget as HTMLAnchorElement).style.borderColor  = "#E0E0E0";
            }}
          >
            {/* Icon */}
            <span
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
              style={{ backgroundColor: iconBg, color: iconColor }}
              aria-hidden="true"
            >
              <Icon size={20} strokeWidth={1.75} />
            </span>

            {/* Text */}
            <div>
              <p style={{ color: "#212121", fontSize: "14px", fontWeight: 600, lineHeight: "20px" }}>
                {label}
              </p>
              <p className="mt-0.5" style={{ color: "#9E9E9E", fontSize: "12px", lineHeight: "16px" }}>
                {description}
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
