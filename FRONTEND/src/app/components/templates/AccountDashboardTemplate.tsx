import { useNavigate } from "react-router";
import { AuthHeader }              from "../organisms/AuthHeader";
import { UserStatsRow }            from "../organisms/UserStatsRow";
import { ActivityFeed }            from "../organisms/ActivityFeed";
import { InlineNotificationsPanel }from "../organisms/InlineNotificationsPanel";
import { QuickAccessStrip }        from "../organisms/QuickAccessStrip";
import { Footer }                  from "../organisms/Footer";
import { useCurrentUser }          from "../../lib/useCurrentUser";
import { getSessionEmail }         from "../../lib/session";

/* Live timestamp shown in the page-title row */
function LastUpdated() {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return (
    <p style={{ color: "#9E9E9E", fontSize: "13px", lineHeight: "18px", letterSpacing: "0.25px" }}>
      Last updated: <span style={{ color: "#212121", fontWeight: 500 }}>{time}</span>
    </p>
  );
}

export function AccountDashboardTemplate() {
  const navigate = useNavigate();
  const { profile } = useCurrentUser();
  const userName  = profile?.username ?? "";
  const userEmail = profile?.email ?? getSessionEmail() ?? "";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ fontFamily: "'Inter','SF Pro Text','Roboto',sans-serif", backgroundColor: "#F5F5F5" }}
    >
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 z-[100] px-4 py-2 rounded-md bg-[#1A73E8] text-white text-sm font-medium"
      >
        Skip to main content
      </a>

      {/* Fixed authenticated header */}
      <AuthHeader userName={userName} userEmail={userEmail} />

      {/* Scrollable main content — no sidebar, full width */}
      <main
        id="main-content"
        className="flex-1 flex flex-col"
        style={{ paddingTop: "64px" /* header offset */ }}
      >
        <div className="flex-1 flex flex-col gap-6 px-6 py-6 w-full max-w-[1200px] mx-auto">

          {/* ── Page Title Row ──────────────────────────────── */}
          <div className="flex items-center justify-between">
            <h1 style={{ color: "#212121" }}>Dashboard</h1>
            <LastUpdated />
          </div>

          {/* ── Summary Widgets Row ──────────────────────────── */}
          <UserStatsRow activeSessions={profile?.activeSessions ?? null} status={profile?.status ?? null} />

          {/* ── Content Row (60/40 split) ───────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* Left — Activity Feed (60% ≈ 3/5) */}
            <div className="xl:col-span-3">
              <ActivityFeed />
            </div>

            {/* Right — Notifications Panel (40% ≈ 2/5) */}
            <div className="xl:col-span-2">
              <InlineNotificationsPanel />
            </div>
          </div>

          {/* ── Quick Access Strip ──────────────────────────── */}
          <QuickAccessStrip />
        </div>

        {/* Footer — bottom of scrollable content */}
        <Footer />
      </main>
    </div>
  );
}
