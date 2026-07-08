**IMPORTANT SECURITY NOTE (read first):** During this read-only investigation I found **live, unredacted secrets committed to the repo** in `c:\Users\PoonamBiswas\devPB\AI@SDLC\SPEC_GENERATION\UMS\.env` and `sendgrid.env` — a real SendGrid API key, DB credentials, and an OTP HMAC secret. These are shown redacted below, but you should rotate/remove them from version control immediately. No files were modified during this investigation.

---

# 1. Full file tree under `src/`

Two separate `src/` trees exist in this repo — the request's "React/TypeScript frontend" is actually located at `FRONTEND/src`, not the top-level `src/` (which is a Node/Express backend service with no React/TSX at all — no `LandingTemplate` etc. exist there). Both are listed for completeness; **all subsequent sections (2–7) apply to `FRONTEND/src`**, since that's where the templates/components/react-router code actually live.

## 1a. Top-level `src/` (backend — Express/TypeScript, NOT the frontend)
```
src/controllers/.gitkeep
src/services/.gitkeep
src/validators/.gitkeep
src/repositories/.gitkeep
src/adapters/.gitkeep
src/workers/.gitkeep
src/types/.gitkeep
src/config/.gitkeep
src/errors/.gitkeep
src/middleware/.gitkeep
src/errors/registration.errors.ts
src/config/password-policy.config.ts
src/repositories/token.repository.ts
src/repositories/email-record.repository.ts
src/validators/registration.validator.ts
src/validators/email.validator.ts
src/validators/password-policy.evaluator.ts
src/validators/username-uniqueness.validator.ts
src/routes/registration.routes.ts
src/adapters/email-delivery.port.ts
src/workers/outbox.worker.ts
src/services/email-dispatch.service.ts
src/services/activation.service.ts
src/controllers/activation.controller.ts
src/routes/activation.routes.ts
src/controllers/admin.controller.ts
src/middleware/admin-auth.middleware.ts
src/routes/admin.routes.ts
src/controllers/registration.controller.ts
src/services/registration.service.ts
src/errors/otp.errors.ts
src/types/otp.types.ts
src/adapters/otp-delivery.port.ts
src/repositories/otp-request.repository.ts
src/services/rate-limit.guard.ts
src/services/otp.service.ts
src/controllers/otp.controller.ts
src/routes/otp.routes.ts
src/config/otp.config.ts
src/adapters/email-otp-delivery.adapter.ts
src/services/rate-limit.guard.test.ts
src/adapters/email-otp-delivery.adapter.test.ts
src/integration/otp.integration.spec.ts
src/errors/login.errors.ts
src/config/session.config.ts
src/config/lockout.config.ts
src/repositories/session.repository.ts
src/types/login.types.ts
src/repositories/password-recovery-request.repository.ts
src/middleware/session-validation.middleware.ts
src/middleware/session-validation.middleware.test.ts
src/services/password-hasher.ts
src/services/login-guard.ts
src/services/auth.service.ts
src/controllers/auth.controller.ts
src/routes/auth.routes.ts
src/controllers/auth.controller.test.ts
src/services/password-recovery.service.ts
src/controllers/password.controller.ts
src/controllers/password.controller.test.ts
src/controllers/health.controller.ts
src/routes/health.routes.ts
src/controllers/health.controller.test.ts
src/routes/password.routes.ts
src/types/account-deletion.types.ts
src/errors/account-deletion.errors.ts
src/config/account-deletion.config.ts
src/repositories/deletion-request.repository.ts
src/repositories/deletion-notification-record.repository.ts
src/repositories/user.repository.ts
src/types/registration.types.ts
src/services/session.service.property.test.ts
src/services/login-guard.test.ts
src/services/session.service.test.ts
src/services/otp.service.test.ts
src/services/auth.service.test.ts
src/services/password-recovery.service.test.ts
src/services/auth.service.property.test.ts
src/services/password-recovery.service.property.test.ts
src/services/account-deletion.service.test.ts
src/controllers/deletion.controller.ts
src/routes/deletion.routes.ts
src/controllers/deletion.controller.test.ts
src/workers/account-deletion-notification.worker.ts
src/workers/account-deletion-notification.worker.test.ts
src/services/session.service.ts
src/integration/registration.integration.spec.ts
src/integration/login.integration.spec.ts
src/integration/deletion.integration.spec.ts
src/services/account-deletion.service.ts
src/services/account-deletion.service.property.test.ts
src/app.ts
src/config/app.config.ts
src/adapters/sendgrid-email.adapter.ts
src/server.ts
```
This backend's `package.json` (`name: "user-management-service"`) has **no react-router**, no frontend deps at all — it's Express/pg/ioredis/bcrypt/SendGrid. Not relevant to templates.

## 1b. `FRONTEND/src/` (the actual React/TS frontend — this is the tree relevant to items 2–7)
```
FRONTEND/src/main.tsx
FRONTEND/src/app/App.tsx
FRONTEND/src/app/routes.ts
FRONTEND/src/app/components/ui/accordion.tsx
FRONTEND/src/app/components/ui/alert-dialog.tsx
FRONTEND/src/app/components/ui/alert.tsx
FRONTEND/src/app/components/ui/aspect-ratio.tsx
FRONTEND/src/app/components/ui/avatar.tsx
FRONTEND/src/app/components/ui/badge.tsx
FRONTEND/src/app/components/ui/breadcrumb.tsx
FRONTEND/src/app/components/ui/button.tsx
FRONTEND/src/app/components/ui/calendar.tsx
FRONTEND/src/app/components/ui/card.tsx
FRONTEND/src/app/components/ui/carousel.tsx
FRONTEND/src/app/components/ui/chart.tsx
FRONTEND/src/app/components/ui/checkbox.tsx
FRONTEND/src/app/components/ui/collapsible.tsx
FRONTEND/src/app/components/ui/command.tsx
FRONTEND/src/app/components/ui/context-menu.tsx
FRONTEND/src/app/components/ui/dialog.tsx
FRONTEND/src/app/components/ui/drawer.tsx
FRONTEND/src/app/components/ui/dropdown-menu.tsx
FRONTEND/src/app/components/ui/form.tsx
FRONTEND/src/app/components/ui/hover-card.tsx
FRONTEND/src/app/components/ui/input-otp.tsx
FRONTEND/src/app/components/ui/input.tsx
FRONTEND/src/app/components/ui/label.tsx
FRONTEND/src/app/components/ui/menubar.tsx
FRONTEND/src/app/components/ui/navigation-menu.tsx
FRONTEND/src/app/components/ui/pagination.tsx
FRONTEND/src/app/components/ui/popover.tsx
FRONTEND/src/app/components/ui/progress.tsx
FRONTEND/src/app/components/ui/radio-group.tsx
FRONTEND/src/app/components/ui/resizable.tsx
FRONTEND/src/app/components/ui/scroll-area.tsx
FRONTEND/src/app/components/ui/select.tsx
FRONTEND/src/app/components/ui/separator.tsx
FRONTEND/src/app/components/ui/sheet.tsx
FRONTEND/src/app/components/ui/sidebar.tsx
FRONTEND/src/app/components/ui/skeleton.tsx
FRONTEND/src/app/components/ui/slider.tsx
FRONTEND/src/app/components/ui/sonner.tsx
FRONTEND/src/app/components/ui/switch.tsx
FRONTEND/src/app/components/ui/table.tsx
FRONTEND/src/app/components/ui/tabs.tsx
FRONTEND/src/app/components/ui/textarea.tsx
FRONTEND/src/app/components/ui/toggle-group.tsx
FRONTEND/src/app/components/ui/toggle.tsx
FRONTEND/src/app/components/ui/tooltip.tsx
FRONTEND/src/app/components/ui/use-mobile.ts
FRONTEND/src/app/components/ui/utils.ts
FRONTEND/src/app/components/figma/ImageWithFallback.tsx
FRONTEND/src/app/components/atoms/Logo.tsx
FRONTEND/src/app/components/atoms/NavLink.tsx
FRONTEND/src/app/components/molecules/FeatureCard.tsx
FRONTEND/src/app/components/molecules/MobileMenu.tsx
FRONTEND/src/app/components/molecules/FormField.tsx
FRONTEND/src/app/components/molecules/PasswordStrengthBar.tsx
FRONTEND/src/app/components/molecules/CountdownResend.tsx
FRONTEND/src/app/components/molecules/OtpInputGroup.tsx
FRONTEND/src/app/components/molecules/PasswordInput.tsx
FRONTEND/src/app/components/molecules/StatWidget.tsx
FRONTEND/src/app/components/molecules/WarningBanner.tsx
FRONTEND/src/app/components/organisms/CTASection.tsx
FRONTEND/src/app/components/organisms/FeaturesSection.tsx
FRONTEND/src/app/components/organisms/Footer.tsx
FRONTEND/src/app/components/organisms/Header.tsx
FRONTEND/src/app/components/organisms/HeroSection.tsx
FRONTEND/src/app/components/organisms/RegistrationForm.tsx
FRONTEND/src/app/components/organisms/OtpVerificationForm.tsx
FRONTEND/src/app/components/organisms/LoginForm.tsx
FRONTEND/src/app/components/organisms/ActivityChart.tsx
FRONTEND/src/app/components/organisms/AuthHeader.tsx
FRONTEND/src/app/components/organisms/DashboardSidebar.tsx
FRONTEND/src/app/components/organisms/NotificationsPanel.tsx
FRONTEND/src/app/components/organisms/QuickAccessGrid.tsx
FRONTEND/src/app/components/organisms/RecentActivityTable.tsx
FRONTEND/src/app/components/organisms/StatsRow.tsx
FRONTEND/src/app/components/organisms/ActivityFeed.tsx
FRONTEND/src/app/components/organisms/InlineNotificationsPanel.tsx
FRONTEND/src/app/components/organisms/QuickAccessStrip.tsx
FRONTEND/src/app/components/organisms/UserStatsRow.tsx
FRONTEND/src/app/components/organisms/AccountDeletionCard.tsx
FRONTEND/src/app/components/organisms/DeleteConfirmationModal.tsx
FRONTEND/src/app/components/organisms/IdentityVerificationCard.tsx
FRONTEND/src/app/components/templates/LandingTemplate.tsx
FRONTEND/src/app/components/templates/RegistrationTemplate.tsx
FRONTEND/src/app/components/templates/OtpVerificationTemplate.tsx
FRONTEND/src/app/components/templates/LoginTemplate.tsx
FRONTEND/src/app/components/templates/DashboardTemplate.tsx
FRONTEND/src/app/components/templates/AccountDashboardTemplate.tsx
FRONTEND/src/app/components/templates/AccountDeletionTemplate.tsx
FRONTEND/src/styles/tailwind.css
FRONTEND/src/styles/index.css
FRONTEND/src/styles/fonts.css
FRONTEND/src/styles/theme.css
FRONTEND/src/styles/globals.css
FRONTEND/src/imports/UxStyleGuide__11_.pdf
FRONTEND/src/imports/User_Authentication_and_Management_System___Site_Map.pdf
FRONTEND/src/imports/Landing_Screen_screen_layout.pdf
FRONTEND/src/imports/User_Registration_Screen_screen_layout.pdf
FRONTEND/src/imports/OTP_Verification_Screen_screen_layout.pdf
FRONTEND/src/imports/User_Login_Screen_screen_layout.pdf
FRONTEND/src/imports/Dashboard_Screen_screen_layout.pdf
FRONTEND/src/imports/Dashboard_Screen_screen_layout__1_.pdf
FRONTEND/src/imports/Account_Deletion_Screen_screen_layout.pdf
FRONTEND/src/imports/pasted_text/style-guide.md
```

Note: **no `types/`, `models/`, `services/`, `lib/`, or `api/` folder exists anywhere under `FRONTEND/src`** — see section 4.

---

# 2. Full source of the 7 Template components

## `LandingTemplate` — `FRONTEND/src/app/components/templates/LandingTemplate.tsx`
```tsx
import { useNavigate } from "react-router";
import { Header } from "../organisms/Header";
import { HeroSection } from "../organisms/HeroSection";
import { FeaturesSection } from "../organisms/FeaturesSection";
import { CTASection } from "../organisms/CTASection";
import { Footer } from "../organisms/Footer";

export function LandingTemplate() {
  const navigate = useNavigate();

  const goToRegister = () => navigate("/register");
  const goToLogin    = () => navigate("/login");

  const navItems = [
    { label: "Home",     href: "#home"     },
    { label: "Features", href: "#features" },
    { label: "About",    href: "#about"    },
  ];

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ fontFamily: "'Inter','SF Pro Text','Roboto',sans-serif" }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 z-[100] px-4 py-2 rounded-md bg-[#1A73E8] text-white text-sm font-medium"
      >
        Skip to main content
      </a>

      <Header onSignIn={goToLogin} onRegister={goToRegister} navItems={navItems} />

      <main className="flex-1" id="main-content">
        <HeroSection onGetStarted={goToRegister} onSignIn={goToLogin} />
        <FeaturesSection />
        <CTASection onRegister={goToRegister} onSignIn={goToLogin} />
      </main>

      <Footer />
    </div>
  );
}
```

## `RegistrationTemplate` — `FRONTEND/src/app/components/templates/RegistrationTemplate.tsx`
```tsx
import { useNavigate } from "react-router";
import { Header } from "../organisms/Header";
import { RegistrationForm } from "../organisms/RegistrationForm";
import { Footer } from "../organisms/Footer";

const NAV_ITEMS = [
  { label: "Home",     href: "/"          },
  { label: "Features", href: "/#features" },
  { label: "About",    href: "/#about"    },
];

export function RegistrationTemplate() {
  const navigate = useNavigate();

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ fontFamily: "'Inter','SF Pro Text','Roboto',sans-serif", backgroundColor: "#F5F5F5" }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 z-[100] px-4 py-2 rounded-md bg-[#1A73E8] text-white text-sm font-medium"
      >
        Skip to main content
      </a>

      <Header
        onSignIn={() => navigate("/login")}
        onRegister={() => {
          document.getElementById("registration-card")?.scrollIntoView({ behavior: "smooth" });
        }}
        navItems={NAV_ITEMS}
      />

      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-4 sm:px-6"
        style={{ paddingTop: "calc(64px + 48px)", paddingBottom: "48px" }}
      >
        <div id="registration-card" className="w-full flex justify-center">
          <RegistrationForm />
        </div>
      </main>

      <Footer />
    </div>
  );
}
```

## `OtpVerificationTemplate` — `FRONTEND/src/app/components/templates/OtpVerificationTemplate.tsx`
```tsx
import { useLocation, useNavigate } from "react-router";
import { Header } from "../organisms/Header";
import { OtpVerificationForm } from "../organisms/OtpVerificationForm";
import { Footer } from "../organisms/Footer";

const NAV_ITEMS = [
  { label: "Home",     href: "/"          },
  { label: "Features", href: "/#features" },
  { label: "About",    href: "/#about"    },
];

export function OtpVerificationTemplate() {
  const location = useLocation();
  const navigate = useNavigate();

  const email: string = (location.state as { email?: string })?.email ?? "";

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ fontFamily: "'Inter','SF Pro Text','Roboto',sans-serif", backgroundColor: "#F5F5F5" }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 z-[100] px-4 py-2 rounded-md bg-[#1A73E8] text-white text-sm font-medium"
      >
        Skip to main content
      </a>

      <Header
        onSignIn={() => navigate("/login")}
        onRegister={() => navigate("/register")}
        navItems={NAV_ITEMS}
      />

      <main
        id="main-content"
        className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6"
        style={{ paddingTop: "calc(64px + 48px)", paddingBottom: "48px" }}
      >
        <div className="w-full max-w-[480px] text-center mb-8">
          <h1 className="mb-3" style={{ color: "#212121" }}>OTP Verification</h1>
          <p style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px" }}>
            Enter the 6-digit code sent to your registered email address.
          </p>
        </div>

        <OtpVerificationForm email={email} />

        <p
          className="mt-6 px-4 py-2.5 rounded-lg border border-[#FBC02D] text-center max-w-[480px] w-full"
          style={{
            backgroundColor: "#FFF8E1",
            color: "#F57F17",
            fontSize: "12px",
            lineHeight: "16px",
            letterSpacing: "0.25px",
          }}
          role="note"
        >
          <strong>Demo:</strong> Enter{" "}
          <span className="font-mono font-semibold">123456</span> to simulate successful verification.
        </p>
      </main>

      <Footer />
    </div>
  );
}
```

## `LoginTemplate` — `FRONTEND/src/app/components/templates/LoginTemplate.tsx`
```tsx
import { useNavigate } from "react-router";
import { Header } from "../organisms/Header";
import { LoginForm } from "../organisms/LoginForm";
import { Footer } from "../organisms/Footer";

const NAV_ITEMS = [
  { label: "Home",     href: "/"          },
  { label: "Features", href: "/#features" },
  { label: "About",    href: "/#about"    },
];

export function LoginTemplate() {
  const navigate = useNavigate();

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ fontFamily: "'Inter','SF Pro Text','Roboto',sans-serif", backgroundColor: "#F5F5F5" }}
    >
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 z-[100] px-4 py-2 rounded-md bg-[#1A73E8] text-white text-sm font-medium"
      >
        Skip to main content
      </a>

      {/* Fixed header — Sign In is current page, Register navigates to /register */}
      <Header
        onSignIn={() => navigate("/login")}
        onRegister={() => navigate("/register")}
        navItems={NAV_ITEMS}
      />

      {/* Main — vertically and horizontally centered */}
      <main
        id="main-content"
        className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6"
        style={{
          paddingTop:    "calc(64px + 48px)",
          paddingBottom: "48px",
        }}
      >
        <LoginForm />

        {/* Demo hint */}
        <p
          className="mt-6 px-4 py-2.5 rounded-lg border border-[#FBC02D] text-center max-w-[480px] w-full"
          style={{
            backgroundColor: "#FFF8E1",
            color: "#F57F17",
            fontSize: "12px",
            lineHeight: "16px",
            letterSpacing: "0.25px",
          }}
          role="note"
        >
          <strong>Demo:</strong> Use any valid email and password{" "}
          <span className="font-mono font-semibold">password123</span> to log in.
        </p>
      </main>

      <Footer />
    </div>
  );
}
```

## `DashboardTemplate` — `FRONTEND/src/app/components/templates/DashboardTemplate.tsx`
```tsx
import { useLocation } from "react-router";
import { AuthHeader }               from "../organisms/AuthHeader";
import { UserStatsRow }             from "../organisms/UserStatsRow";
import { ActivityFeed }             from "../organisms/ActivityFeed";
import { InlineNotificationsPanel } from "../organisms/InlineNotificationsPanel";
import { QuickAccessStrip }         from "../organisms/QuickAccessStrip";
import { Footer }                   from "../organisms/Footer";

function LastUpdated() {
  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return (
    <p style={{ color: "#9E9E9E", fontSize: "13px", lineHeight: "18px", letterSpacing: "0.25px" }}>
      Last updated:{" "}
      <span style={{ color: "#212121", fontWeight: 500 }}>{time}</span>
    </p>
  );
}

export function DashboardTemplate() {
  const location  = useLocation();
  const state     = location.state as { name?: string; email?: string } | null;
  const userName  = state?.name  ?? "Jane Smith";
  const userEmail = state?.email ?? "jane@example.com";

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

      {/* Full-width scrollable main — no sidebar */}
      <main
        id="main-content"
        className="flex-1 flex flex-col"
        style={{ paddingTop: "64px" }}
      >
        <div className="flex-1 flex flex-col gap-6 px-6 py-6 w-full max-w-[1200px] mx-auto">

          {/* Page Title Row */}
          <div className="flex items-center justify-between">
            <h1 style={{ color: "#212121" }}>Dashboard</h1>
            <LastUpdated />
          </div>

          {/* 4-column Summary Widgets */}
          <UserStatsRow />

          {/* 2-column Content Row — 60 / 40 split */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-3">
              <ActivityFeed />
            </div>
            <div className="xl:col-span-2">
              <InlineNotificationsPanel />
            </div>
          </div>

          {/* Quick Access horizontal strip */}
          <QuickAccessStrip />
        </div>

        <Footer />
      </main>
    </div>
  );
}
```

## `AccountDashboardTemplate` — `FRONTEND/src/app/components/templates/AccountDashboardTemplate.tsx`
```tsx
import { useNavigate, useLocation } from "react-router";
import { AuthHeader }              from "../organisms/AuthHeader";
import { UserStatsRow }            from "../organisms/UserStatsRow";
import { ActivityFeed }            from "../organisms/ActivityFeed";
import { InlineNotificationsPanel }from "../organisms/InlineNotificationsPanel";
import { QuickAccessStrip }        from "../organisms/QuickAccessStrip";
import { Footer }                  from "../organisms/Footer";

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
  const location = useLocation();

  const state     = location.state as { name?: string; email?: string } | null;
  const userName  = state?.name  ?? "Jane Smith";
  const userEmail = state?.email ?? "jane@example.com";

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

          {/* ── Summary Widgets Row (4-col) ─────────────────── */}
          <UserStatsRow />

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
```
Note: `AccountDashboardTemplate` and `DashboardTemplate` are near-duplicates (both render identical content: header, `UserStatsRow`, `ActivityFeed`, `InlineNotificationsPanel`, `QuickAccessStrip`, footer). They are mapped to two different routes (`/dashboard` and `/account-dashboard`).

## `AccountDeletionTemplate` — `FRONTEND/src/app/components/templates/AccountDeletionTemplate.tsx`
```tsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Trash2, CheckCircle } from "lucide-react";
import { Header }                    from "../organisms/Header";
import { WarningBanner }             from "../molecules/WarningBanner";
import { IdentityVerificationCard }  from "../organisms/IdentityVerificationCard";
import { AccountDeletionCard }       from "../organisms/AccountDeletionCard";
import { DeleteConfirmationModal }   from "../organisms/DeleteConfirmationModal";
import { Footer }                    from "../organisms/Footer";

/* Nav items — cross-page hrefs */
const NAV_ITEMS = [
  { label: "Home",     href: "/"          },
  { label: "Features", href: "/#features" },
  { label: "About",    href: "/#about"    },
];

/* ── Success state after deletion ───────────────────── */
function DeletionSuccessScreen() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center text-center gap-5 py-12">
      <span
        className="inline-flex items-center justify-center w-20 h-20 rounded-full"
        style={{ backgroundColor: "rgba(56,142,60,0.10)" }}
        aria-hidden="true"
      >
        <CheckCircle size={40} style={{ color: "#388E3C" }} />
      </span>
      <div className="flex flex-col gap-2">
        <h2 style={{ color: "#212121" }}>Account Deleted</h2>
        <p style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px", maxWidth: 380 }}>
          Your account has been permanently deleted. All personal data has been
          removed from our systems. We're sorry to see you go.
        </p>
      </div>
      <button
        onClick={() => navigate("/")}
        className="mt-2 inline-flex items-center gap-2 px-6 h-12 rounded-md text-sm font-semibold text-white bg-[#1A73E8] hover:bg-[#1557B0] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(26,115,232,0.4)]"
        style={{ boxShadow: "0px 2px 4px rgba(0,0,0,0.1)", letterSpacing: "0.5px" }}
      >
        Return to Home
      </button>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────── */
export function AccountDeletionTemplate() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const state     = location.state as { email?: string; name?: string } | null;
  const userEmail = state?.email ?? "user@example.com";

  const [verified,     setVerified]     = useState(false);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [deleted,      setDeleted]      = useState(false);

  const handleVerified    = () => setVerified(true);
  const handleDeleteClick = () => setModalOpen(true);
  const handleModalCancel = () => setModalOpen(false);
  const handleConfirmed   = () => {
    setModalOpen(false);
    setDeleted(true);
  };
  const handleCancel = () => navigate(-1);

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

      {/* Standard header */}
      <Header
        onSignIn={() => navigate("/login")}
        onRegister={() => navigate("/register")}
        navItems={NAV_ITEMS}
      />

      {/* Main content — max-width 720px, centred */}
      <main
        id="main-content"
        className="flex-1 flex flex-col"
        style={{ paddingTop: "calc(64px + 48px)", paddingBottom: "48px" }}
      >
        <div className="w-full mx-auto px-4 sm:px-6 flex flex-col gap-6" style={{ maxWidth: "720px" }}>

          {deleted ? (
            /* ── Success ───────────────────────────────────── */
            <DeletionSuccessScreen />
          ) : (
            <>
              {/* Page title — H1, centered */}
              <div className="flex flex-col items-center gap-2 text-center">
                <span
                  className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-1"
                  style={{ backgroundColor: "rgba(211,47,47,0.10)" }}
                  aria-hidden="true"
                >
                  <Trash2 size={26} style={{ color: "#D32F2F" }} />
                </span>
                <h1 style={{ color: "#212121" }}>Delete Your Account</h1>
                <p style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px", maxWidth: 480 }}>
                  Follow the steps below to permanently remove your account and all associated data.
                </p>
              </div>

              {/* Warning banner */}
              <WarningBanner
                title="Warning"
                message="This action is permanent and cannot be undone. All your personal data will be removed from the system."
              />

              {/* Step indicator */}
              <div className="flex items-center gap-3" aria-label="Progress steps">
                {/* Step 1 */}
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: verified ? "rgba(56,142,60,0.10)" : "#1A73E8",
                      color:           verified ? "#388E3C"                : "#FFFFFF",
                      border:          verified ? "2px solid #388E3C"      : "none",
                    }}
                    aria-current={!verified ? "step" : undefined}
                  >
                    {verified ? "✓" : "1"}
                  </span>
                  <span style={{ color: "#212121", fontSize: "13px", fontWeight: 500 }}>
                    Verify Identity
                  </span>
                </div>
                {/* Connector */}
                <div
                  className="flex-1 h-0.5 rounded"
                  style={{ backgroundColor: verified ? "#388E3C" : "#E0E0E0" }}
                  aria-hidden="true"
                />
                {/* Step 2 */}
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: verified ? "#D32F2F"               : "#F5F5F5",
                      color:           verified ? "#FFFFFF"                : "#9E9E9E",
                      border:          verified ? "none"                   : "2px solid #E0E0E0",
                    }}
                    aria-current={verified ? "step" : undefined}
                  >
                    2
                  </span>
                  <span style={{ color: verified ? "#212121" : "#9E9E9E", fontSize: "13px", fontWeight: 500 }}>
                    Delete Account
                  </span>
                </div>
              </div>

              {/* Card 1 — Identity Verification (always visible, collapses after verify) */}
              {!verified && (
                <IdentityVerificationCard
                  email={userEmail}
                  onVerified={handleVerified}
                />
              )}

              {/* Verified confirmation banner */}
              {verified && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-3 px-5 py-3.5 rounded-lg border"
                  style={{ backgroundColor: "rgba(56,142,60,0.06)", borderColor: "#388E3C" }}
                >
                  <CheckCircle size={18} style={{ color: "#388E3C" }} aria-hidden="true" />
                  <p style={{ color: "#1B5E20", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                    Identity verified successfully. You may now proceed with account deletion.
                  </p>
                </div>
              )}

              {/* Card 2 — Account Deletion (revealed after verification) */}
              {verified && (
                <div
                  className="animate-in slide-in-from-bottom-4 duration-300"
                  aria-label="Account deletion options, now available"
                >
                  <AccountDeletionCard
                    onDeleteClick={handleDeleteClick}
                    onCancel={handleCancel}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />

      {/* Confirmation modal */}
      <DeleteConfirmationModal
        isOpen={modalOpen}
        onConfirm={handleConfirmed}
        onCancel={handleModalCancel}
      />
    </div>
  );
}
```

---

# 3. Grep results for `fetch(`, `axios`, `api/v1`, `localhost:3000`, `.post(`, `.get(`

**Result: zero matches for any of these patterns anywhere under `FRONTEND/src`.** A single combined grep (`fetch\(|axios|api/v1|localhost:3000|\.post\(|\.get\(`) across the whole `FRONTEND/src` tree returned **no matches**. This confirms the frontend does not make any HTTP/API calls at all — no fetch, no axios, no `.post()`/`.get()` HTTP-client calls, no `api/v1` path references, no hardcoded `localhost:3000` URL.

(No exclusions were needed for `.get(`-style false positives such as `searchParams.get`, `formData.get`, or `Map.get` — there weren't any occurrences of `.get(` at all in the source, false-positive or otherwise.)

Note: `localhost:3000` **does** appear in the backend's env files (`ACTIVATION_BASE_URL=http://localhost:3000`, `PORT=3000`, etc. in `.env`/`.env.example` at the repo root) — that's backend config, not frontend code, and is covered in section 4 below.

---

# 4. API client / types / env files / auth context

## API client / HTTP wrapper
**None exists.** No `src/lib/api*`, `src/services/api*`, `src/api/*`, or any equivalent under `FRONTEND/src`. There is no HTTP client abstraction of any kind in the frontend.

## Types/interfaces for API requests/responses
**None exists.** No `FRONTEND/src/types/*` or `FRONTEND/src/models/*` directory. The only "types" are local TS interfaces defined inline inside components (e.g. `ActivityItem`, `InlineNotif`, `Tile`, `StatCardProps` — all UI-prop shapes, not API contracts).

(The top-level backend `src/types/` folder does have real domain types — `otp.types.ts`, `login.types.ts`, `account-deletion.types.ts`, `registration.types.ts` — but these belong to the Express backend, not the frontend, and are not imported by any frontend file.)

## `.env` files
No `.env`/`.env.example` file exists inside `FRONTEND/`. Three env files exist at the **repository root** (backend-side), and they contain hardcoded secrets that should be rotated:

### `.env.example` (root) — safe template, no real secrets
```
PGHOST=localhost
PGPORT=5432
PGDATABASE=ums_db
PGUSER=ums_user
PGPASSWORD=your_pg_password_here
PASSWORD_MIN_LENGTH=8
PASSWORD_MAX_LENGTH=128
PASSWORD_REQUIRES_UPPERCASE=true
PASSWORD_REQUIRES_LOWERCASE=true
PASSWORD_REQUIRES_DIGIT=true
PASSWORD_REQUIRES_SPECIAL=true
TOKEN_EXPIRY_HOURS=24
ACTIVATION_BASE_URL=http://localhost:3000
BCRYPT_COST_FACTOR=12
OUTBOX_POLL_INTERVAL_MS=30000
OUTBOX_MAX_RETRIES=1
SENDGRID_API_KEY=<redacted>
SENDGRID_TEMPLATE_ID=<redacted>
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=User Management Service
ADMIN_BEARER_TOKEN=<redacted>
OTP_LENGTH=6
OTP_TTL_MINUTES=10
OTP_MAX_ATTEMPTS_PER_WINDOW=5
OTP_RATE_LIMIT_WINDOW_MINUTES=15
OTP_HASH_ALGORITHM=sha256
OTP_HASH_SECRET=<redacted>
SMS_PROVIDER_ENABLED=true
OTP_EMAIL_TEMPLATE_ID=<redacted>
REDIS_URL=redis://localhost:6379
SESSION_EXPIRY_SECONDS=3600
LOGIN_LOCKOUT_THRESHOLD=5
LOGIN_LOCKOUT_DURATION_MINUTES=15
PASSWORD_RECOVERY_TOKEN_EXPIRY_HOURS=1
PASSWORD_RECOVERY_BASE_URL=poonam.biswas@xebia.com   <-- NOTE: this "example" value is a personal email, not a placeholder URL
PASSWORD_RECOVERY_EMAIL_TEMPLATE_ID=<redacted>
ACCOUNT_DELETION_TOKEN_EXPIRY_HOURS=24
ACCOUNT_DELETION_BASE_URL=https://app.example.com
ACCOUNT_DELETION_REQUEST_EMAIL_TEMPLATE_ID=<redacted>
ACCOUNT_DELETION_NOTICE_EMAIL_TEMPLATE_ID=<redacted>
PORT=3000
NODE_ENV=development
FRONTEND_ORIGIN=
```

### `.env` (root) — **CONTAINS LIVE SECRETS — redacted below**
```
PGHOST=<redacted - internal WSL IP>
PGPORT=5432
PGDATABASE=ums_db
PGUSER=postgres
PGPASSWORD=<redacted>
PASSWORD_MIN_LENGTH=8
PASSWORD_MAX_LENGTH=128
PASSWORD_REQUIRES_UPPERCASE=true
PASSWORD_REQUIRES_LOWERCASE=true
PASSWORD_REQUIRES_DIGIT=true
PASSWORD_REQUIRES_SPECIAL=true
TOKEN_EXPIRY_HOURS=24
ACTIVATION_BASE_URL=http://localhost:3000
BCRYPT_COST_FACTOR=12
OUTBOX_POLL_INTERVAL_MS=30000
OUTBOX_MAX_RETRIES=1
SENDGRID_API_KEY=<redacted - LIVE SendGrid API key>
SENDGRID_TEMPLATE_ID=<redacted>
FROM_EMAIL=<redacted - personal email>
FROM_NAME="User Management Service"
ADMIN_BEARER_TOKEN=<redacted>
OTP_LENGTH=6
OTP_TTL_MINUTES=10
OTP_MAX_ATTEMPTS_PER_WINDOW=5
OTP_RATE_LIMIT_WINDOW_MINUTES=15
OTP_HASH_ALGORITHM=sha256
OTP_HASH_SECRET=<redacted - LIVE HMAC secret>
SMS_PROVIDER_ENABLED=true
OTP_EMAIL_TEMPLATE_ID=<redacted>
REDIS_URL=redis://localhost:6379
SESSION_EXPIRY_SECONDS=3600
LOGIN_LOCKOUT_THRESHOLD=5
LOGIN_LOCKOUT_DURATION_MINUTES=15
PASSWORD_RECOVERY_TOKEN_EXPIRY_HOURS=1
PASSWORD_RECOVERY_BASE_URL=http://localhost:3000
PASSWORD_RECOVERY_EMAIL_TEMPLATE_ID=<redacted>
ACCOUNT_DELETION_TOKEN_EXPIRY_HOURS=24
ACCOUNT_DELETION_BASE_URL=http://localhost:3000
ACCOUNT_DELETION_REQUEST_EMAIL_TEMPLATE_ID=<redacted>
ACCOUNT_DELETION_NOTICE_EMAIL_TEMPLATE_ID=<redacted>
PORT=3000
NODE_ENV=development
FRONTEND_ORIGIN=
```

### `sendgrid.env` (root) — **CONTAINS A LIVE SENDGRID API KEY** (a shell `export` one-liner, appears to be UTF-16 encoded)
```
export SENDGRID_API_KEY='<redacted - LIVE SendGrid API key, identical value to .env>'
```
**Action recommended:** rotate this SendGrid API key immediately and remove/redact `.env` and `sendgrid.env` from git history if they were ever committed.

## Auth context / hook / store
**None exists in the frontend.** Grepping `useAuth|AuthContext|authStore|AuthProvider` across `FRONTEND/src` returned **zero matches**. There is no session/auth state management layer at all — no context, no hook, no store, no token storage. Login/logout are purely client-side navigation:
- `LoginForm.tsx` simply calls `navigate("/dashboard")` on success — no session is created/stored anywhere.
- `AuthHeader.tsx`'s `handleLogout` just calls `navigate("/login")` — no token/session is cleared because none exists.
- The backend (top-level `src/`) does have real session/login/lockout logic (`src/services/session.service.ts`, `src/services/login-guard.ts`, `src/services/auth.service.ts`, `src/middleware/session-validation.middleware.ts`) but **none of it is wired to the frontend**.

---

# 5. Per-template analysis: forms, backend calls, loading/error states, mock data

## `LandingTemplate`
- **Form:** No. It's a marketing/landing page (Header, HeroSection, FeaturesSection, CTASection, Footer). No inputs.
- **Backend call:** None.
- **Loading/error states:** None (nothing async).
- **Mock/hardcoded data:** `navItems` array is hardcoded (`Home`/`Features`/`About` anchors) — purely UI, not "fake API data."

## `RegistrationTemplate`
- **Form:** Yes, via child `RegistrationForm` (organism). Fields (by `id`):
  - `reg-name` — Full Name (text, `autoComplete="name"`)
  - `reg-email` — Email Address (type="email", `autoComplete="email"`)
  - `reg-password` — Password (type="password"/"text" toggle, `autoComplete="new-password"`)
  - Plus a password-strength indicator (`reg-password-strength`, purely derived client-side, not a field)
- **Backend call:** No real call. `RegistrationForm.handleSubmit` does:
  ```ts
  setLoading(true);
  /* simulate API call */
  await new Promise((r) => setTimeout(r, 1200));
  setLoading(false);
  navigate("/verify-otp", { state: { email: fields.email, name: fields.name } });
  ```
  This is a `setTimeout` fake delay — no `fetch`/`axios`, no actual network request, and registration always "succeeds" (there is no failure path modeled).
- **Loading/error states:** Loading — yes, `loading` state disables the submit button and swaps its label/icon for a spinner + "Creating account…". Error — only client-side field-validation errors (`errors.name/email/password`, shown inline under each `FormField` when the field is `touched`). There is **no server/API error state** (e.g. "email already exists") anywhere in this flow.
- **Mock/hardcoded data:** The entire submission is simulated (`setTimeout`); no real API response is used, and the flow always proceeds to `/verify-otp` regardless of the (nonexistent) backend outcome.

## `OtpVerificationTemplate`
- **Form:** Yes, via child `OtpVerificationForm`. Field: a single OTP value composed from 6 digit inputs (managed by `OtpInputGroup`, value state named `otp`, no discrete DOM `name`/`id` per digit — the group as a whole represents the verification code).
- **Backend call:** No real call. `handleVerify` in `OtpVerificationForm.tsx`:
  ```ts
  setLoading(true);
  setError("");
  /* Simulate API verification */
  await new Promise((r) => setTimeout(r, 1200));
  setLoading(false);
  if (toVerify === DEMO_OTP) { ... } else { ... }
  ```
  where `const DEMO_OTP = "123456";` is a hardcoded "correct" answer compared client-side — there is no server round trip. The Resend button (`handleResend`) also has a comment `/* In a real app: trigger resend API */` and does nothing but reset local state. `CountdownResend.tsx` similarly does `await new Promise((r) => setTimeout(r, 800)); /* simulate API */` for the resend action.
- **Loading/error states:** Loading — yes (`loading` disables the Verify button, shows a spinner + "Verifying…", and disables the OTP input group). Error — yes, an inline `role="alert"` banner ("The code you entered is incorrect. Please try again.") shown when the entered code doesn't match `DEMO_OTP`. No true network/API error state exists since there's no real network call.
- **Mock/hardcoded data:** `DEMO_OTP = "123456"` is the hardcoded "correct" code; the template itself even displays a demo hint telling the user to type `123456`.

## `LoginTemplate`
- **Form:** Yes, via child `LoginForm`. Fields (by `id`):
  - `login-email` — Email Address (type="email", `autoComplete="email"`)
  - `login-password` — Password (`autoComplete="current-password"`)
  - Also a non-functional "Forgot Password?" link (`onClick={(e) => e.preventDefault()}` — a no-op placeholder, not wired to any route or modal).
- **Backend call:** No real call. `LoginForm.handleSubmit`:
  ```ts
  setLoading(true);
  setAuthError("");
  await new Promise((r) => setTimeout(r, 1200));
  setLoading(false);
  if (fields.password === DEMO_PASSWORD) {
    navigate("/dashboard");
  } else {
    setAuthError("Invalid email or password. Please try again.");
    ...
  }
  ```
  where `const DEMO_PASSWORD = "password123";` — any email plus that exact password "succeeds," entirely client-side, no session/token is created.
- **Loading/error states:** Loading — yes (`loading` disables submit, shows spinner + "Signing in…"). Error — yes: (a) field-level validation errors under each input, and (b) an `AuthErrorBanner` (`role="alert"`) shown above the form when `DEMO_PASSWORD` doesn't match, reading "Invalid email or password. Please try again."
- **Mock/hardcoded data:** `DEMO_PASSWORD = "password123"` hardcoded; the template shows a demo hint with this exact password. No real credential check exists.

## `DashboardTemplate`
- **Form:** No. It's a read-only dashboard (stat widgets, activity feed, notifications panel, quick-access strip).
- **Backend call:** None — no fetch/axios anywhere in this template or its children.
- **Loading/error states:** None. No loading spinners, no error UI — the dashboard renders synchronously from local hardcoded arrays (see below).
- **Mock/hardcoded data:** Extensive:
  - `userName`/`userEmail` default to hardcoded `"Jane Smith"` / `"jane@example.com"` if no `location.state` was passed by a previous navigation (e.g. if the user lands here directly without going through Login).
  - `UserStatsRow.tsx` — hardcoded stat values: `"1,240"` Total Users (+4.2%), `"87"` Active Sessions (+1.1%), `"5 New"` Pending Notifications, `"Active"`/`"Verified"` Account Status.
  - `ActivityFeed.tsx` — a hardcoded `ITEMS: ActivityItem[]` array of 7 fake activity-log rows with fixed static timestamps ("10:44 AM", "10:30 AM", etc.).
  - `InlineNotificationsPanel.tsx` — a hardcoded `INITIAL: InlineNotif[]` array of 3 fake notifications ("Password changed successfully.", "New device detected...", "Account identity verified."), dismissible only in local component state (no persistence).
  - `QuickAccessStrip.tsx` — hardcoded `TILES` array; 3 of 4 tiles link to `href="#"` (non-functional placeholders), only "Delete Account" routes to a real path (`/delete-account`).

## `AccountDashboardTemplate`
- Functionally and structurally identical to `DashboardTemplate` (same `AuthHeader`, `UserStatsRow`, `ActivityFeed`, `InlineNotificationsPanel`, `QuickAccessStrip`, `Footer`, same default hardcoded `userName`/`userEmail` fallback). It is a separate template mounted at a separate route (`/account-dashboard`) but contains no distinct logic — all findings from `DashboardTemplate` above apply here identically (no form, no real backend call, no loading/error UI, same mock/hardcoded stat and activity data).

## `AccountDeletionTemplate`
- **Form:** Yes, via two child components:
  - `IdentityVerificationCard` — fields `del-email` (read-only, pre-filled email), `del-password` (Password, `autoComplete="current-password"`), `del-otp` ("2FA / OTP Code (if enabled)", optional, digits only, max 6 chars).
  - `AccountDeletionCard` — a single checkbox `del-agree` ("I understand this is permanent...") gating the "Delete My Account" button; no other form fields (this is a confirmation UI, not a data-entry form).
  - `DeleteConfirmationModal` — a modal dialog with "Yes, Delete My Account" / "Cancel" buttons; no form fields.
- **Backend call:** No real call anywhere in this flow:
  - `IdentityVerificationCard.handleSubmit`: `await new Promise((r) => setTimeout(r, 1200)); /* simulate API */` then calls `onVerified()` unconditionally (any non-empty password + valid-length OTP "succeeds" — there's no actual credential check against a backend).
  - `DeleteConfirmationModal.handleConfirm`: `await new Promise((r) => setTimeout(r, 1500)); /* simulate deletion API */` then calls `onConfirm()` — the account is never actually deleted anywhere; it's purely a client-side state transition (`setDeleted(true)` in the parent template) that swaps in a "Account Deleted" success screen.
- **Loading/error states:** Loading — yes, both `IdentityVerificationCard`'s submit button (spinner + "Verifying…") and `DeleteConfirmationModal`'s confirm button (spinner + "Deleting…") show loading state during their fake delays. Error — only client-side field validation (`pwdError`, `otpError` — "Password is required.", "Enter all 6 digits."). There is **no server/API error path** (e.g. "incorrect password," "deletion failed") modeled anywhere in this flow — verification and deletion always succeed after their timeouts.
- **Mock/hardcoded data:** `userEmail` defaults to hardcoded `"user@example.com"` if no `location.state.email` was passed in. The whole verify→delete pipeline is simulated with `setTimeout` and always succeeds; no real destructive action or backend interaction occurs.

---

# 6. react-router version and routing style

- **Exact version:** `"react-router": "7.13.0"` — found in `FRONTEND/package.json`, under the **`dependencies`** block (not `peerDependencies`; `peerDependencies` in that file only lists `react` and `react-dom` at `18.3.1`, both marked `optional: true`). So react-router 7.13.0 is a direct dependency, confirmed exact version.

- **Routing style:** This **is** using react-router v7's modern data-router API, not legacy `<Routes>/<Route>` JSX-based routing:
  - `FRONTEND/src/app/routes.ts` calls `createBrowserRouter([...])` from `"react-router"` and defines a flat array of route objects, each with a `path` and a `Component` (not `element`) key, e.g. `{ path: "/", Component: LandingTemplate }`.
  - `FRONTEND/src/app/App.tsx` renders `<RouterProvider router={router} />`.
  - **No** `loader:`, `action:`, `useLoaderData`, or `useActionData` are used anywhere — the router is created with plain `{ path, Component }` route objects and no data-loading/action functions at all. So while the *router construction API* (`createBrowserRouter`) is the v7 "data router" mechanism, none of v7's actual data-loading features (loaders/actions) are exercised.
  - **No** `<Routes>` or `<Route>` JSX elements exist anywhere in `FRONTEND/src`.
  - `useNavigate` is used pervasively (in `LandingTemplate`, `RegistrationTemplate`, `OtpVerificationTemplate`, `LoginTemplate`, `AccountDashboardTemplate`, `AccountDeletionTemplate`, `DashboardSidebar`, `AuthHeader`, `LoginForm`, `OtpVerificationForm`, `RegistrationForm`) for all navigation, and `useLocation`/`location.state` is used to pass ad-hoc data between routes (e.g. passing `email`/`name` from Registration → OTP verification, or `name`/`email` into the dashboards) instead of any loader-based data fetching.
  - Net summary: **component-based routing with client-side `useNavigate`/`location.state`-driven flow**, built on top of react-router v7's `createBrowserRouter`/`RouterProvider`, but with zero use of loaders/actions — effectively the same pattern as v6 route-config routing, just using v7's object-based router constructor instead of JSX `<Route>` elements.

---

# 7. TODO / FIXME / "not implemented" / mock / fake / placeholder comments

Grepping `TODO|FIXME|not implemented|NotImplemented|TODO:|FIXME:|mock|fake|placeholder` (case-insensitive) across `FRONTEND/src` found no literal `TODO`/`FIXME`/`NotImplemented` comments, but did surface simulated-API comments and placeholder-labeled UI (the closest equivalents in this codebase). No genuine `TODO:`/`FIXME:` markers exist anywhere in the frontend source.

Comments explicitly marking simulated/fake backend behavior (these are the de-facto "integration TODOs"):
- `FRONTEND/src/app/components/organisms/RegistrationForm.tsx:141` — `/* simulate API call */`
- `FRONTEND/src/app/components/organisms/OtpVerificationForm.tsx:73` — `/* Simulate API verification */`
- `FRONTEND/src/app/components/organisms/OtpVerificationForm.tsx:47` — `const DEMO_OTP = "123456"; /* simulated correct code */`
- `FRONTEND/src/app/components/organisms/OtpVerificationForm.tsx:95` — `/* In a real app: trigger resend API */`
- `FRONTEND/src/app/components/molecules/CountdownResend.tsx:30` — `await new Promise((r) => setTimeout(r, 800)); /* simulate API */`
- `FRONTEND/src/app/components/organisms/IdentityVerificationCard.tsx:34` — `await new Promise((r) => setTimeout(r, 1200)); /* simulate API */`
- `FRONTEND/src/app/components/organisms/DeleteConfirmationModal.tsx:17` — `await new Promise((r) => setTimeout(r, 1500)); /* simulate deletion API */`
- `FRONTEND/src/app/components/organisms/LoginForm.tsx:20` — `/* Demo credentials — any valid email + "password123" succeeds */`
- `FRONTEND/src/app/components/templates/LoginTemplate.tsx:46,58` — `{/* Demo hint */}` / `<strong>Demo:</strong> Use any valid email and password ... to log in.`
- `FRONTEND/src/app/components/templates/OtpVerificationTemplate.tsx:61-62` — `<strong>Demo:</strong> Enter 123456 to simulate successful verification.`

"placeholder"-literal matches (mostly benign, listed with exclusion rationale):
- `FRONTEND/src/app/components/molecules/FormField.tsx:7,22,35,64` — the `placeholder` HTML input attribute/prop name (excluded from concern — this is the standard HTML input placeholder text feature, not a code stub).
- `FRONTEND/src/app/components/molecules/PasswordInput.tsx:6,17,28,46` — same, HTML `placeholder` attribute.
- `FRONTEND/src/app/components/organisms/RegistrationForm.tsx:43,57,180,193` and `LoginForm.tsx:172,192` and `IdentityVerificationCard.tsx:104,121` — same, HTML `placeholder` attribute usage (e.g. `placeholder="Jane Smith"`, `placeholder="you@example.com"`).
- `FRONTEND/src/app/components/ui/*.tsx` (`command.tsx:69`, `input.tsx:11`, `textarea.tsx:11`, `select.tsx:44`) — Tailwind's `placeholder:` CSS variant class name, not a code placeholder.
- `FRONTEND/src/app/components/molecules/OtpInputGroup.tsx:6,11,47` and `FRONTEND/src/app/components/ui/input-otp.tsx:47,60` — `hasFakeCaret` is a prop from the underlying `input-otp` library indicating a simulated text-cursor for styling (a legitimate library API, not a mock/fake data marker).
- `FRONTEND/src/app/components/organisms/QuickAccessStrip.tsx` — the tile labels `"Feature 1"` / `"Feature 2"` (visible in file contents above) are effectively unlabeled placeholder text for two of the four Quick Access tiles (both link to `href="#"`), even though the word "placeholder" doesn't literally appear there — worth flagging for integration planning even though it wasn't caught by the literal grep.
- Matches inside `FRONTEND/src/imports/*.pdf` and `FRONTEND/src/imports/pasted_text/style-guide.md` are binary/design-reference artifacts (Figma-exported PDFs and a design style guide), not source code — excluded from actionable findings.

No occurrences of the literal strings `TODO`, `FIXME`, `not implemented`, or `NotImplemented` were found anywhere in `FRONTEND/src`.
