import { type LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  iconColor?: string;
  iconBg?: string;
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  iconColor = "#1A73E8",
  iconBg = "rgba(26, 115, 232, 0.1)",
}: FeatureCardProps) {
  return (
    <div
      className="group flex flex-col gap-4 rounded-lg bg-white border border-[#E0E0E0] p-6 transition-shadow duration-300"
      style={{ boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.08)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0px 4px 16px rgba(0, 0, 0, 0.12)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0px 2px 8px rgba(0, 0, 0, 0.08)";
      }}
    >
      {/* Icon — 32px featured size */}
      <div
        className="inline-flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
        style={{ backgroundColor: iconBg, color: iconColor }}
        aria-hidden="true"
      >
        <Icon size={32} strokeWidth={1.75} />
      </div>

      {/* Text */}
      <div className="flex flex-col gap-2">
        <h3 style={{ color: "#212121" }}>{title}</h3>
        <p className="text-sm leading-5" style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px" }}>
          {description}
        </p>
      </div>
    </div>
  );
}
