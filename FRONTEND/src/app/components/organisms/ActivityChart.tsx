import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

const WEEKLY_DATA = [
  { day: "Mon", users: 420, sessions: 580 },
  { day: "Tue", users: 380, sessions: 510 },
  { day: "Wed", users: 560, sessions: 720 },
  { day: "Thu", users: 490, sessions: 640 },
  { day: "Fri", users: 610, sessions: 790 },
  { day: "Sat", users: 280, sessions: 360 },
  { day: "Sun", users: 240, sessions: 310 },
];

const SERIES = [
  { key: "users",    name: "New Users",       color: "#1A73E8" },
  { key: "sessions", name: "Active Sessions", color: "#00897B" },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border border-[#E0E0E0] bg-white px-4 py-3"
      style={{ boxShadow: "0px 4px 16px rgba(0,0,0,0.12)" }}
    >
      <p style={{ color: "#212121", fontSize: "13px", fontWeight: 600, marginBottom: 6 }}>
        {label}
      </p>
      {payload.map((p: any) => (
        <p key={`tooltip-${p.dataKey}`} style={{ color: p.color, fontSize: "12px", lineHeight: "18px" }}>
          {p.name}: <strong>{p.value.toLocaleString()}</strong>
        </p>
      ))}
    </div>
  );
};

export function ActivityChart() {
  return (
    <section
      aria-labelledby="chart-heading"
      className="rounded-lg border border-[#E0E0E0] bg-white p-5"
      style={{ boxShadow: "0px 2px 8px rgba(0,0,0,0.06)" }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h2
          id="chart-heading"
          style={{ color: "#212121", fontSize: "16px", fontWeight: 600, lineHeight: "24px" }}
        >
          Weekly Activity
        </h2>
        <span style={{ color: "#9E9E9E", fontSize: "12px", letterSpacing: "0.25px" }}>
          Last 7 days
        </span>
      </div>

      {/* Custom legend — rendered outside recharts to avoid duplicate-key warning */}
      <div className="flex items-center gap-5 mb-4" role="list" aria-label="Chart legend">
        {SERIES.map((s) => (
          <div key={`legend-${s.key}`} className="flex items-center gap-1.5" role="listitem">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            <span style={{ color: "#9E9E9E", fontSize: "12px", lineHeight: "16px" }}>
              {s.name}
            </span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ height: 220 }} aria-label="Bar chart showing weekly new users and active sessions">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={WEEKLY_DATA} barCategoryGap="30%" barGap={4}>
            <CartesianGrid key="grid" vertical={false} stroke="#F0F0F0" />
            <XAxis
              key="xaxis"
              dataKey="day"
              tick={{ fill: "#9E9E9E", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              key="yaxis"
              tick={{ fill: "#9E9E9E", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              key="tooltip"
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(26,115,232,0.04)" }}
            />
            <Bar key="bar-users"    dataKey="users"    name="New Users"       fill="#1A73E8" radius={[4,4,0,0]} />
            <Bar key="bar-sessions" dataKey="sessions" name="Active Sessions" fill="#00897B" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
