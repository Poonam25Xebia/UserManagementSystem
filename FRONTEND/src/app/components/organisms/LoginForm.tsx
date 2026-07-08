import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, AlertCircle, LogIn } from "lucide-react";
import { FormField } from "../molecules/FormField";
import { PasswordInput } from "../molecules/PasswordInput";
import { loginUser } from "../../lib/api-client";
import { setSession } from "../../lib/session";

/* ── Validation ───────────────────────────────────────── */
const validate = {
  email: (v: string) => {
    if (!v.trim()) return "Email address is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address.";
    return "";
  },
  password: (v: string) => {
    if (!v) return "Password is required.";
    return "";
  },
};

/* ── Backend error_code → user-facing message ─────────── */
function messageForError(status: number, body: { error?: string; error_code?: string; message?: string; retry_after?: string }): string {
  switch (body.error_code) {
    case "AUTH_INVALID_CREDENTIALS":
      return "Invalid email or password. Please try again.";
    case "AUTH_ACCOUNT_NOT_ACTIVE":
      return body.message || "Your account is not active yet. Please verify your email first.";
    case "AUTH_ACCOUNT_LOCKED": {
      const retryTime = body.retry_after ? new Date(body.retry_after).toLocaleTimeString() : "shortly";
      return `Too many failed attempts. Your account is locked until ${retryTime}.`;
    }
    case "SESSION_CREATION_FAILED":
      return "We couldn't sign you in right now. Please try again.";
    default:
      return body.error || body.message || "Something went wrong. Please try again.";
  }
}

/* ── "or" Divider ─────────────────────────────────────── */
function OrDivider() {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label="or">
      <div className="flex-1 h-px" style={{ backgroundColor: "#E0E0E0" }} />
      <span
        style={{
          color: "#9E9E9E",
          fontSize: "12px",
          lineHeight: "16px",
          letterSpacing: "0.25px",
          flexShrink: 0,
        }}
      >
        or
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: "#E0E0E0" }} />
    </div>
  );
}

/* ── Auth error banner ────────────────────────────────── */
function AuthErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-2.5 px-4 py-3 rounded-md border"
      style={{
        backgroundColor: "#FFEBEE",
        borderColor: "#D32F2F",
      }}
    >
      <AlertCircle
        size={16}
        className="flex-shrink-0 mt-0.5"
        aria-hidden="true"
        style={{ color: "#D32F2F" }}
      />
      <p style={{ color: "#B71C1C", fontSize: "14px", lineHeight: "20px" }}>
        {message}
      </p>
    </div>
  );
}

/* ── Forgot Password modal (inline, no separate page) ─── */
function ForgotPasswordLink() {
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className="self-end hover:underline underline-offset-2 transition-colors"
      style={{ color: "#1A73E8", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}
      aria-label="Reset your password"
    >
      Forgot Password?
    </a>
  );
}

/* ── LoginForm ────────────────────────────────────────── */
export function LoginForm() {
  const navigate = useNavigate();

  const [fields, setFields]   = useState({ email: "", password: "" });
  const [errors, setErrors]   = useState({ email: "", password: "" });
  const [touched, setTouched] = useState({ email: false, password: false });
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const setField = (key: keyof typeof fields) => (v: string) => {
    setFields((prev) => ({ ...prev, [key]: v }));
    if (authError) setAuthError("");
    if (touched[key]) setErrors((prev) => ({ ...prev, [key]: validate[key](v) }));
  };

  const handleBlur = (key: keyof typeof fields) => () => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: validate[key](fields[key]) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors = {
      email:    validate.email(fields.email),
      password: validate.password(fields.password),
    };
    setErrors(nextErrors);
    setTouched({ email: true, password: true });
    if (Object.values(nextErrors).some(Boolean)) return;

    setLoading(true);
    setAuthError("");

    try {
      const result = await loginUser({ email: fields.email, password: fields.password });

      if (result.ok) {
        setSession(result.data.token, result.data.expires_at, fields.email);
        navigate("/dashboard", { state: { email: fields.email } });
        return;
      }

      setAuthError(messageForError(result.status, result.body));
      setFields((prev) => ({ ...prev, password: "" }));
      setTouched((prev) => ({ ...prev, password: false }));
    } catch {
      setAuthError("Unable to reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const emailError    = touched.email    ? errors.email    : "";
  const passwordError = touched.password ? errors.password : "";

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
      {/* Header block */}
      <div className="flex flex-col items-center gap-1 text-center mb-8">
        <span
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
          style={{ backgroundColor: "rgba(26,115,232,0.08)" }}
          aria-hidden="true"
        >
          <LogIn size={26} style={{ color: "#1A73E8" }} />
        </span>

        {/* H1 */}
        <h1 style={{ color: "#212121" }}>Welcome Back</h1>

        {/* Subtitle — Body Regular 14px muted */}
        <p style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px" }}>
          Sign in to your account to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {/* Auth error banner */}
        {authError && <AuthErrorBanner message={authError} />}

        {/* Email Address */}
        <FormField
          id="login-email"
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          value={fields.email}
          onChange={setField("email")}
          onBlur={handleBlur("email")}
          error={emailError}
          autoComplete="email"
        />

        {/* Password + Forgot link */}
        <div className="flex flex-col gap-1.5">
          <FormField
            id="login-password"
            label="Password"
            value={fields.password}
            onChange={setField("password")}
            onBlur={handleBlur("password")}
            error={passwordError}
          >
            <PasswordInput
              id="login-password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={fields.password}
              onChange={setField("password")}
              onBlur={handleBlur("password")}
              hasError={Boolean(passwordError)}
            />
          </FormField>

          {/* Forgot Password — right-aligned, below password field */}
          <div className="flex justify-end mt-0.5">
            <ForgotPasswordLink />
          </div>
        </div>

        {/* Login button — primary, full-width */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-md font-semibold text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(26,115,232,0.4)] group disabled:cursor-not-allowed mt-1"
          style={{
            fontSize: "14px",
            letterSpacing: "0.5px",
            backgroundColor: loading ? "#9E9E9E" : "#1A73E8",
            boxShadow: loading ? "none" : "0px 2px 4px rgba(0,0,0,0.1)",
          }}
          onMouseEnter={(e) => {
            if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1557B0";
          }}
          onMouseLeave={(e) => {
            if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1A73E8";
          }}
          aria-label={loading ? "Signing in…" : "Login"}
        >
          {loading ? (
            <>
              <svg className="animate-spin" width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              Signing in…
            </>
          ) : (
            <>
              Login
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </>
          )}
        </button>

        {/* "or" divider */}
        <OrDivider />

        {/* Create an Account link */}
        <p className="text-center" style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px" }}>
          Don't have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="font-medium hover:underline underline-offset-2 transition-colors"
            style={{ color: "#1A73E8", fontSize: "14px" }}
          >
            Create an Account
          </button>
        </p>
      </form>
    </div>
  );
}
