import { Monitor, ShieldCheck, ShieldAlert, ShieldQuestion, type LucideIcon } from "lucide-react";

/* ── Generic stat widget ────────────────────────────────── */
interface StatCardProps {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  badge?: React.ReactNode;
}

function StatCard({ icon: Icon, iconColor, iconBg, label, value, badge }: StatCardProps) {
  return (
    <div
      className="flex flex-col gap-4 rounded-lg border border-[#E0E0E0] bg-white p-5 transition-shadow duration-200 hover:shadow-md"
      style={{ boxShadow: "0px 2px 8px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0"
          style={{ backgroundColor: iconBg, color: iconColor }}
          aria-hidden="true"
        >
          <Icon size={20} strokeWidth={1.75} />
        </span>
        {badge}
      </div>

      <div className="flex flex-col gap-0.5">
        <p
          className="tabular-nums"
          style={{ fontSize: "28px", fontWeight: 700, lineHeight: "36px", color: "#212121", letterSpacing: "-0.5px" }}
        >
          {value}
        </p>
        <p style={{ color: "#9E9E9E", fontSize: "13px", lineHeight: "18px" }}>{label}</p>
      </div>
    </div>
  );
}

/* ── Status badge helper ───────────────────────────────── */
function StatusBadge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
      style={{ backgroundColor: bg, color }}
    >
      {text}
    </span>
  );
}

const STATUS_DISPLAY: Record<string, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  active:    { label: "Active",    icon: ShieldCheck,    color: "#388E3C", bg: "rgba(56,142,60,0.10)" },
  pending:   { label: "Pending",   icon: ShieldQuestion, color: "#FF6D00", bg: "rgba(255,109,0,0.10)" },
  suspended: { label: "Suspended", icon: ShieldAlert,    color: "#D32F2F", bg: "rgba(211,47,47,0.10)" },
  deleted:   { label: "Deleted",   icon: ShieldAlert,    color: "#D32F2F", bg: "rgba(211,47,47,0.10)" },
};

interface UserStatsRowProps {
  activeSessions: number | null;
  status: "pending" | "active" | "suspended" | "deleted" | null;
}

/* ── UserStatsRow ──────────────────────────────────────── */
export function UserStatsRow({ activeSessions, status }: UserStatsRowProps) {
  const statusDisplay = status ? STATUS_DISPLAY[status] : null;

  return (
    <section aria-label="Account summary metrics">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Active Sessions */}
        <StatCard
          icon={Monitor}
          iconColor="#00897B"
          iconBg="rgba(0,137,123,0.10)"
          label="Active Sessions"
          value={activeSessions === null ? "—" : String(activeSessions)}
        />

        {/* Account Status */}
        <StatCard
          icon={statusDisplay?.icon ?? ShieldQuestion}
          iconColor={statusDisplay?.color ?? "#9E9E9E"}
          iconBg={statusDisplay?.bg ?? "rgba(158,158,158,0.10)"}
          label="Account Status"
          value={statusDisplay?.label ?? "—"}
          badge={
            statusDisplay && (
              <StatusBadge text={statusDisplay.label} color={statusDisplay.color} bg={statusDisplay.bg} />
            )
          }
        />
      </div>
    </section>
  );
}
