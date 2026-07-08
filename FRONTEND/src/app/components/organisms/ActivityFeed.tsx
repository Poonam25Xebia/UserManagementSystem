import {
  LogIn, UserCheck, AlertTriangle,
  Monitor, Settings, ArrowRight,
} from "lucide-react";

interface ActivityItem {
  id: number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  description: string;
  time: string;
  isAlert?: boolean;
}

const ITEMS: ActivityItem[] = [
  {
    id: 1,
    icon: LogIn,
    iconColor: "#1A73E8",
    iconBg: "rgba(26,115,232,0.10)",
    description: "User login",
    time: "10:44 AM",
  },
  {
    id: 2,
    icon: UserCheck,
    iconColor: "#388E3C",
    iconBg: "rgba(56,142,60,0.10)",
    description: "Profile updated",
    time: "10:30 AM",
  },
  {
    id: 3,
    icon: AlertTriangle,
    iconColor: "#D32F2F",
    iconBg: "rgba(211,47,47,0.10)",
    description: "Failed login attempt",
    time: "10:15 AM",
    isAlert: true,
  },
  {
    id: 4,
    icon: LogIn,
    iconColor: "#1A73E8",
    iconBg: "rgba(26,115,232,0.10)",
    description: "User login",
    time: "9:58 AM",
  },
  {
    id: 5,
    icon: Monitor,
    iconColor: "#00897B",
    iconBg: "rgba(0,137,123,0.10)",
    description: "Session started",
    time: "9:45 AM",
  },
  {
    id: 6,
    icon: LogIn,
    iconColor: "#1A73E8",
    iconBg: "rgba(26,115,232,0.10)",
    description: "User login",
    time: "9:30 AM",
  },
  {
    id: 7,
    icon: Settings,
    iconColor: "#9E9E9E",
    iconBg: "rgba(158,158,158,0.10)",
    description: "Settings changed",
    time: "9:10 AM",
  },
];

export function ActivityFeed() {
  return (
    <section
      aria-labelledby="activity-feed-heading"
      className="flex flex-col rounded-lg border border-[#E0E0E0] bg-white overflow-hidden"
      style={{ boxShadow: "0px 2px 8px rgba(0,0,0,0.06)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0E0]">
        <h2
          id="activity-feed-heading"
          style={{ color: "#212121", fontSize: "18px", fontWeight: 600, lineHeight: "28px" }}
        >
          Recent Activity
        </h2>
        <span style={{ color: "#9E9E9E", fontSize: "12px", letterSpacing: "0.25px" }}>
          Today
        </span>
      </div>

      {/* List */}
      <ul role="list" className="flex-1 divide-y divide-[#F0F0F0]">
        {ITEMS.map((item, idx) => {
          const Icon = item.icon;
          const isEven = idx % 2 === 0;
          return (
            <li
              key={item.id}
              className="flex items-center gap-4 px-5 py-3"
              style={{ backgroundColor: isEven ? "#FFFFFF" : "#FAFAFA" }}
            >
              {/* Icon */}
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                style={{ backgroundColor: item.iconBg, color: item.iconColor }}
                aria-hidden="true"
              >
                <Icon size={16} strokeWidth={1.75} />
              </span>

              {/* Description */}
              <p
                className="flex-1 min-w-0 truncate"
                style={{
                  color: item.isAlert ? "#D32F2F" : "#212121",
                  fontSize: "14px",
                  fontWeight: item.isAlert ? 500 : 400,
                  lineHeight: "20px",
                }}
              >
                {item.description}
              </p>

              {/* Timestamp — muted, right-aligned */}
              <time
                dateTime={item.time}
                style={{ color: "#9E9E9E", fontSize: "12px", lineHeight: "16px", letterSpacing: "0.25px", flexShrink: 0 }}
              >
                {item.time}
              </time>
            </li>
          );
        })}
      </ul>

      {/* Footer — View All */}
      <div className="px-5 py-3 border-t border-[#E0E0E0] flex justify-end">
        <a
          href="#"
          className="inline-flex items-center gap-1 text-sm font-medium text-[#1A73E8] hover:text-[#1557B0] hover:underline underline-offset-2 transition-colors"
          aria-label="View all activity"
        >
          View All
          <ArrowRight size={14} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
