import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";

interface StatWidgetProps {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  trend: number;   /* positive = up, negative = down, 0 = flat */
  trendLabel?: string;
}

export function StatWidget({ icon: Icon, iconColor, iconBg, label, value, trend, trendLabel }: StatWidgetProps) {
  const isUp   = trend > 0;
  const isDown = trend < 0;
  const trendColor = isUp ? "#388E3C" : isDown ? "#D32F2F" : "#9E9E9E";
  const TrendIcon  = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const sign       = isUp ? "+" : "";
  const display    = trendLabel ?? `${sign}${Math.abs(trend).toFixed(1)}%`;

  return (
    <div
      className="flex flex-col gap-4 rounded-lg border border-[#E0E0E0] bg-white p-5 transition-shadow duration-200 hover:shadow-md"
      style={{ boxShadow: "0px 2px 8px rgba(0,0,0,0.06)" }}
    >
      {/* Top row — icon + trend */}
      <div className="flex items-start justify-between">
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0"
          style={{ backgroundColor: iconBg, color: iconColor }}
          aria-hidden="true"
        >
          <Icon size={20} strokeWidth={1.75} />
        </span>

        {/* Trend badge */}
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{
            backgroundColor: `${trendColor}18`,
            color: trendColor,
          }}
          aria-label={`Trend: ${display}`}
        >
          <TrendIcon size={11} aria-hidden="true" />
          {display}
        </span>
      </div>

      {/* Metric */}
      <div className="flex flex-col gap-0.5">
        <p
          className="tabular-nums"
          style={{ fontSize: "28px", fontWeight: 700, lineHeight: "36px", color: "#212121", letterSpacing: "-0.5px" }}
          aria-label={`${label}: ${value}`}
        >
          {value}
        </p>
        <p style={{ color: "#9E9E9E", fontSize: "13px", lineHeight: "18px" }}>
          {label}
        </p>
      </div>
    </div>
  );
}
