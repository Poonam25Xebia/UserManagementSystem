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

  const state = location.state as { email?: string; userId?: string } | null;
  const email: string = state?.email ?? "";
  const userId: string = state?.userId ?? "";

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

        <OtpVerificationForm email={email} userId={userId} />
      </main>

      <Footer />
    </div>
  );
}
