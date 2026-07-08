import { Users, DollarSign, Activity, CheckSquare } from "lucide-react";
import { StatWidget } from "../molecules/StatWidget";

const STATS = [
  {
    icon:      Users,
    iconColor: "#1A73E8",
    iconBg:    "rgba(26,115,232,0.10)",
    label:     "Total Users",
    value:     "12,430",
    trend:     4.2,
  },
  {
    icon:      DollarSign,
    iconColor: "#388E3C",
    iconBg:    "rgba(56,142,60,0.10)",
    label:     "Revenue",
    value:     "$98,200",
    trend:     1.8,
  },
  {
    icon:      Activity,
    iconColor: "#00897B",
    iconBg:    "rgba(0,137,123,0.10)",
    label:     "Active Sessions",
    value:     "3,210",
    trend:     0.5,
  },
  {
    icon:      CheckSquare,
    iconColor: "#FF6D00",
    iconBg:    "rgba(255,109,0,0.10)",
    label:     "Pending Tasks",
    value:     "47",
    trend:     0,
    trendLabel: "0.0%",
  },
];

export function StatsRow() {
  return (
    <section aria-label="Summary metrics">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <StatWidget key={s.label} {...s} />
        ))}
      </div>
    </section>
  );
}
