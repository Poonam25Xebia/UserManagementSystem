import { useState } from "react";
import { ShieldCheck, ArrowRight, Lock } from "lucide-react";
import { FormField }    from "../molecules/FormField";
import { PasswordInput } from "../molecules/PasswordInput";
import { loginUser } from "../../lib/api-client";
import { setSession } from "../../lib/session";

/* Validation */
const validatePassword = (v: string) => (!v ? "Password is required." : "");
const validateOtp      = (v: string) =>
  v && v.length > 0 && v.length < 6 ? "Enter all 6 digits." : "";

interface IdentityVerificationCardProps {
  email: string;
  onVerified: () => void;
}

export function IdentityVerificationCard({ email, onVerified }: IdentityVerificationCardProps) {
  const [password, setPassword]   = useState("");
  const [otp, setOtp]             = useState("");
  const [pwdError, setPwdError]   = useState("");
  const [otpError, setOtpError]   = useState("");
  const [pwdTouched, setPwdTouched] = useState(false);
  const [loading, setLoading]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pErr = validatePassword(password);
    const oErr = validateOtp(otp);
    setPwdError(pErr);
    setOtpError(oErr);
    setPwdTouched(true);
    if (pErr || oErr) return;

    setLoading(true);

    try {
      /* Re-verify the current password against the real login endpoint
         before allowing a destructive action. */
      const result = await loginUser({ email, password });

      if (result.ok) {
        setSession(result.data.token, result.data.expires_at, email);
        onVerified();
        return;
      }

      setPwdError(
        result.status === 401
          ? "Incorrect password. Please try again."
          : result.body.message || result.body.error || "Unable to verify your identity. Please try again."
      );
    } catch {
      setPwdError("Unable to reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="w-full rounded-lg border border-[#E0E0E0] bg-white"
      style={{ padding: "32px", boxShadow: "0px 2px 8px rgba(0,0,0,0.06)" }}
    >
      {/* Card heading */}
      <div className="flex items-center gap-3 mb-6">
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0"
          style={{ backgroundColor: "rgba(26,115,232,0.10)", color: "#1A73E8" }}
          aria-hidden="true"
        >
          <ShieldCheck size={20} strokeWidth={1.75} />
        </span>
        <div>
          <h2 style={{ color: "#212121" }}>Verify Your Identity</h2>
          <p style={{ color: "#9E9E9E", fontSize: "13px", lineHeight: "18px", marginTop: 2 }}>
            Confirm your credentials before proceeding.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {/* Email — read-only */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="del-email"
            style={{ color: "#212121", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}
          >
            Email Address
          </label>
          <div className="relative">
            <input
              id="del-email"
              type="email"
              value={email}
              readOnly
              aria-readonly="true"
              className="w-full h-12 px-4 rounded-md border border-[#E0E0E0] text-sm"
              style={{ backgroundColor: "#F5F5F5", color: "#9E9E9E", cursor: "default" }}
            />
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium px-2 py-0.5 rounded"
              style={{ backgroundColor: "#E0E0E0", color: "#9E9E9E" }}
              aria-hidden="true"
            >
              read-only
            </span>
          </div>
        </div>

        {/* Password */}
        <FormField
          id="del-password"
          label="Password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            if (pwdTouched) setPwdError(validatePassword(v));
          }}
          onBlur={() => { setPwdTouched(true); setPwdError(validatePassword(password)); }}
          error={pwdTouched ? pwdError : ""}
        >
          <PasswordInput
            id="del-password"
            placeholder="Enter your current password"
            autoComplete="current-password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              if (pwdTouched) setPwdError(validatePassword(v));
            }}
            onBlur={() => { setPwdTouched(true); setPwdError(validatePassword(password)); }}
            hasError={Boolean(pwdTouched && pwdError)}
          />
        </FormField>

        {/* OTP / 2FA (optional) */}
        <FormField
          id="del-otp"
          label="2FA / OTP Code (if enabled)"
          type="text"
          placeholder="Enter 6-digit code"
          value={otp}
          onChange={(v) => { setOtp(v.replace(/\D/g, "").slice(0, 6)); setOtpError(""); }}
          onBlur={() => setOtpError(validateOtp(otp))}
          error={otpError}
          autoComplete="one-time-code"
          required={false}
          hint="Leave blank if two-factor authentication is not enabled on your account."
        />

        {/* Verify & Continue — primary, right-aligned */}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 h-12 rounded-md font-semibold text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(26,115,232,0.4)] group disabled:cursor-not-allowed"
            style={{
              fontSize: "14px",
              letterSpacing: "0.5px",
              backgroundColor: loading ? "#9E9E9E" : "#1A73E8",
              boxShadow: loading ? "none" : "0px 2px 4px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1557B0"; }}
            onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1A73E8"; }}
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
                <Lock size={15} aria-hidden="true" />
                Verify &amp; Continue
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
