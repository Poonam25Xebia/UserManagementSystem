const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  active:  { bg: "rgba(56,142,60,0.10)",   color: "#388E3C", label: "Active"  },
  done:    { bg: "rgba(26,115,232,0.10)",   color: "#1A73E8", label: "Done"   },
  pending: { bg: "rgba(255,109,0,0.10)",    color: "#FF6D00", label: "Pending"},
  failed:  { bg: "rgba(211,47,47,0.10)",    color: "#D32F2F", label: "Failed" },
};

const ROWS = [
  { id: 1, activity: "User registration — alex.johnson@email.com",  date: "02/07", status: "active"  },
  { id: 2, activity: "OTP verified — maya.patel@company.com",       date: "01/07", status: "done"    },
  { id: 3, activity: "Password reset — carlos.m@startup.io",       date: "01/07", status: "pending" },
  { id: 4, activity: "Account deletion request — user #3821",       date: "30/06", status: "pending" },
  { id: 5, activity: "Login attempt blocked — suspicious IP",       date: "29/06", status: "failed"  },
];

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

export function RecentActivityTable() {
  return (
    <section
      aria-labelledby="activity-heading"
      className="rounded-lg border border-[#E0E0E0] bg-white overflow-hidden"
      style={{ boxShadow: "0px 2px 8px rgba(0,0,0,0.06)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0E0]">
        <h2
          id="activity-heading"
          style={{ color: "#212121", fontSize: "16px", fontWeight: 600, lineHeight: "24px" }}
        >
          Recent Activity
        </h2>
        <a
          href="#"
          className="text-sm font-medium text-[#1A73E8] hover:text-[#1557B0] hover:underline underline-offset-2 transition-colors"
        >
          View all
        </a>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" aria-label="Recent activity log">
          <thead>
            <tr style={{ backgroundColor: "#F5F5F5" }}>
              {["#", "Activity", "Date", "Status"].map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="px-5 py-3 text-left"
                  style={{
                    color: "#9E9E9E",
                    fontSize: "12px",
                    fontWeight: 600,
                    lineHeight: "16px",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0]">
            {ROWS.map((row, idx) => (
              <tr
                key={row.id}
                className="transition-colors duration-100"
                style={{ backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = "rgba(26,115,232,0.03)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA")}
              >
                <td
                  className="px-5 py-3.5 font-mono text-sm"
                  style={{ color: "#9E9E9E", width: "48px" }}
                >
                  {row.id}
                </td>
                <td className="px-5 py-3.5" style={{ color: "#212121", fontSize: "13px", lineHeight: "18px" }}>
                  {row.activity}
                </td>
                <td
                  className="px-5 py-3.5 font-mono text-sm whitespace-nowrap"
                  style={{ color: "#9E9E9E" }}
                >
                  {row.date}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
