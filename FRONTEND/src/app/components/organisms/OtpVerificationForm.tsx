import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { ShieldCheck, AlertCircle, ArrowRight, Mail } from "lucide-react";
import { OtpInputGroup } from "../molecules/OtpInputGroup";
import { CountdownResend } from "../molecules/CountdownResend";
import { verifyOtp, resendOtp } from "../../lib/api-client";

/* ── Success banner ───────────────────────────────────── */
function SuccessBanner() {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center" role="status" aria-live="polite">
      <span
        className="inline-flex items-center justify-center w-16 h-16 rounded-full"
        style={{ backgroundColor: "rgba(56,142,60,0.1)" }}
      >
        <ShieldCheck size={32} style={{ color: "#388E3C" }} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-2">
        <h2 style={{ color: "#212121" }}>Email Verified!</h2>
        <p style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px" }}>
          Your account has been successfully verified.
          <br />
          Redirecting you to the dashboard…
        </p>
      </div>
      {/* Inline loading dots */}
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full animate-bounce"
            style={{
              backgroundColor: "#1A73E8",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── OtpVerificationForm ──────────────────────────────── */
interface OtpVerificationFormProps {
  email: string;
  userId: string;
}

export function OtpVerificationForm({ email, userId }: OtpVerificationFormProps) {
  const navigate = useNavigate();

  const [otp, setOtp]         = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleChange = (value: string) => {
    setOtp(value);
    if (error) setError(""); /* clear error on new input */
  };

  const handleVerify = useCallback(async (code?: string) => {
    const toVerify = (code ?? otp).trim();

    if (toVerify.length < 6) {
      setError("Please enter all 6 digits of your verification code.");
      return;
    }

    if (!userId) {
      setError("We couldn't find your registration. Please register again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await verifyOtp({ userId, passcode: toVerify });

      if (result.ok) {
        setVerified(true);
        /* Navigate to dashboard after a brief success moment */
        setTimeout(() => navigate("/dashboard"), 2000);
        return;
      }

      setOtp("");
      switch (result.body.errorCode) {
        case "OTP_EXPIRED":
          setError("This code has expired. Please request a new one.");
          break;
        case "OTP_NOT_FOUND":
          setError("No active code was found. Please request a new one.");
          break;
        case "OTP_INVALID":
          setError("The code you entered is incorrect. Please try again.");
          break;
        default:
          setError("Something went wrong verifying your code. Please try again.");
      }
    } catch {
      setOtp("");
      setError("Unable to reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [otp, userId, navigate]);

  /* Auto-submit when all 6 digits are entered */
  const handleComplete = (value: string) => {
    handleVerify(value);
  };

  const handleResend = useCallback(async () => {
    setOtp("");
    setError("");

    if (!userId) {
      setError("We couldn't find your registration. Please register again.");
      return;
    }

    try {
      const result = await resendOtp({ userId });
      if (result.ok && result.data.status === "dispatch_failed") {
        setError("We couldn't resend the code right now. Please try again shortly.");
      } else if (!result.ok) {
        setError("We couldn't resend the code right now. Please try again shortly.");
      }
    } catch {
      setError("Unable to reach the server. Please check your connection and try again.");
    }
  }, [userId]);

  /* Mask the email: j***@example.com */
  const maskedEmail = email
    ? email.replace(/^(.{1,2})(.*)(@.*)$/, (_, a, b, c) => a + b.replace(/./g, "*") + c)
    : "your registered email";

  return (
    /* Card — 480px max-width, 40px padding, 8px radius */
    <div
      className="w-full mx-auto rounded-lg border border-[#E0E0E0] bg-white"
      style={{
        maxWidth: "480px",
        padding: "40px",
        boxShadow: "0px 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      {verified ? (
        <SuccessBanner />
      ) : (
        <div className="flex flex-col gap-6">

          {/* Header block */}
          <div className="flex flex-col gap-2 text-center">
            {/* Icon badge */}
            <span
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl self-center mb-2"
              style={{ backgroundColor: "rgba(26,115,232,0.08)" }}
              aria-hidden="true"
            >
              <Mail size={28} style={{ color: "#1A73E8" }} />
            </span>

            {/* H1 title */}
            <h1 style={{ color: "#212121" }}>OTP Verification</h1>

            {/* Subtitle — muted, 14px */}
            <p style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px" }}>
              Enter the 6-digit OTP sent to your registered email address.
            </p>

            {/* Masked email chip */}
            <p
              className="inline-flex items-center justify-center gap-1.5 self-center px-3 py-1 rounded-full border border-[#E0E0E0]"
              style={{ color: "#212121", fontSize: "13px", lineHeight: "18px", backgroundColor: "#F5F5F5" }}
            >
              <Mail size={12} aria-hidden="true" style={{ color: "#9E9E9E" }} />
              {maskedEmail}
            </p>
          </div>

          {/* OTP input boxes */}
          <div className="flex flex-col gap-3">
            {/* Caption label — 12px per style guide */}
            <label
              style={{
                color: "#9E9E9E",
                fontSize: "12px",
                lineHeight: "16px",
                letterSpacing: "0.25px",
              }}
            >
              Verification Code
            </label>

            <OtpInputGroup
              value={otp}
              onChange={handleChange}
              onComplete={handleComplete}
              hasError={Boolean(error)}
              disabled={loading || verified}
            />

            {/* Error message */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 px-3 py-2.5 rounded-md border"
                style={{
                  backgroundColor: "#FFEBEE",
                  borderColor: "#D32F2F",
                  color: "#B71C1C",
                }}
              >
                <AlertCircle
                  size={16}
                  className="flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                  style={{ color: "#D32F2F" }}
                />
                <p style={{ fontSize: "13px", lineHeight: "18px" }}>{error}</p>
              </div>
            )}
          </div>

          {/* Verify OTP button — primary, full-width */}
          <button
            type="button"
            onClick={() => handleVerify()}
            disabled={loading || otp.length < 6}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-md font-semibold text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(26,115,232,0.4)] group disabled:cursor-not-allowed"
            style={{
              fontSize: "14px",
              letterSpacing: "0.5px",
              backgroundColor: loading || otp.length < 6 ? "#9E9E9E" : "#1A73E8",
              boxShadow: loading || otp.length < 6 ? "none" : "0px 2px 4px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={(e) => {
              if (!loading && otp.length >= 6)
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1557B0";
            }}
            onMouseLeave={(e) => {
              if (!loading && otp.length >= 6)
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1A73E8";
            }}
            aria-label={loading ? "Verifying…" : "Verify OTP"}
          >
            {loading ? (
              <>
                <svg className="animate-spin" width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Verifying…
              </>
            ) : (
              <>
                Verify OTP
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </>
            )}
          </button>

          {/* Divider */}
          <div className="h-px w-full" style={{ backgroundColor: "#E0E0E0" }} aria-hidden="true" />

          {/* Resend section */}
          <CountdownResend onResend={handleResend} disabled={loading} />

          {/* Back link */}
          <p className="text-center" style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px" }}>
            Wrong email?{" "}
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="font-medium hover:underline underline-offset-2 transition-colors"
              style={{ color: "#1A73E8", fontSize: "14px" }}
            >
              Go back
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
