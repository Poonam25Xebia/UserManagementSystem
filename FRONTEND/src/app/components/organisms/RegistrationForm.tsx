import { useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";
import { FormField } from "../molecules/FormField";
import { PasswordStrengthBar, getStrength } from "../molecules/PasswordStrengthBar";
import { registerUser } from "../../lib/api-client";

/* ── Validation helpers ───────────────────────────────── */
const validate = {
  name: (v: string) => {
    if (!v.trim()) return "Full name is required.";
    if (v.trim().length < 2) return "Name must be at least 2 characters.";
    return "";
  },
  username: (v: string) => {
    if (!v.trim()) return "Username is required.";
    return "";
  },
  email: (v: string) => {
    if (!v.trim()) return "Email address is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address.";
    return "";
  },
  password: (v: string) => {
    if (!v) return "Password is required.";
    if (v.length < 8) return "Password must be at least 8 characters.";
    return "";
  },
};

/* ── Server field name → local field key ──────────────── */
const SERVER_FIELD_MAP: Record<string, "username" | "email" | "password" | "passwordConfirm"> = {
  username: "username",
  emailAddress: "email",
  password: "password",
  passwordConfirmation: "passwordConfirm",
};

/* ── Password input with show/hide toggle ─────────────── */
function PasswordInput({
  id,
  value,
  onChange,
  onBlur,
  hasError,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  hasError: boolean;
}) {
  const [show, setShow] = useState(false);

  const inputClass = [
    "w-full h-12 px-4 pr-12 rounded-md border text-sm text-[#212121] placeholder:text-[#9E9E9E] bg-white",
    "transition-all duration-150 outline-none",
    hasError
      ? "border-[#D32F2F] focus:border-[#D32F2F] focus:ring-[3px] focus:ring-[rgba(211,47,47,0.2)]"
      : "border-[#E0E0E0] focus:border-[#1A73E8] focus:ring-[3px] focus:ring-[rgba(26,115,232,0.2)]",
  ].join(" ");

  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        autoComplete="new-password"
        required
        placeholder="Min. 8 characters"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={hasError}
        aria-describedby={`${id}-error ${id}-strength`}
        className={inputClass}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#9E9E9E] hover:text-[#212121] transition-colors"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
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

/* ── Success banner ───────────────────────────────────── */
function SuccessBanner({ email }: { email: string }) {
  return (
    <div
      className="flex flex-col items-center gap-4 py-8 text-center"
      role="status"
      aria-live="polite"
    >
      <span
        className="inline-flex items-center justify-center w-16 h-16 rounded-full"
        style={{ backgroundColor: "rgba(56,142,60,0.1)" }}
      >
        <CheckCircle size={32} style={{ color: "#388E3C" }} />
      </span>
      <div className="flex flex-col gap-2">
        <h2 style={{ color: "#212121" }}>Account Created!</h2>
        <p style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px" }}>
          We've sent a verification code to{" "}
          <strong style={{ color: "#212121" }}>{email}</strong>.
          <br />
          Please check your inbox.
        </p>
      </div>
    </div>
  );
}

/* ── RegistrationForm ─────────────────────────────────── */
export function RegistrationForm() {
  const navigate = useNavigate();

  const [fields, setFields] = useState({ name: "", username: "", email: "", password: "", passwordConfirm: "" });
  const [errors, setErrors] = useState({ name: "", username: "", email: "", password: "", passwordConfirm: "" });
  const [touched, setTouched] = useState({ name: false, username: false, email: false, password: false, passwordConfirm: false });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const clientValidate: Record<keyof typeof fields, (v: string) => string> = {
    ...validate,
    passwordConfirm: (v: string) => {
      if (!v) return "Please confirm your password.";
      if (v !== fields.password) return "Passwords do not match.";
      return "";
    },
  };

  const setField = (key: keyof typeof fields) => (v: string) => {
    setFields((prev) => ({ ...prev, [key]: v }));
    if (formError) setFormError("");
    if (touched[key]) {
      setErrors((prev) => ({ ...prev, [key]: clientValidate[key](v) }));
    }
  };

  const handleBlur = (key: keyof typeof fields) => () => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: clientValidate[key](fields[key]) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    /* validate all fields */
    const nextErrors = {
      name: validate.name(fields.name),
      username: validate.username(fields.username),
      email: validate.email(fields.email),
      password: validate.password(fields.password),
      passwordConfirm: clientValidate.passwordConfirm(fields.passwordConfirm),
    };
    setErrors(nextErrors);
    setTouched({ name: true, username: true, email: true, password: true, passwordConfirm: true });
    setFormError("");

    const hasErrors = Object.values(nextErrors).some(Boolean);
    if (hasErrors) return;

    setLoading(true);
    try {
      const result = await registerUser({
        username: fields.username,
        emailAddress: fields.email,
        password: fields.password,
        passwordConfirmation: fields.passwordConfirm,
      });

      if (result.ok) {
        /* Navigate to OTP screen, passing the email + userId via router state */
        navigate("/verify-otp", {
          state: { email: fields.email, name: fields.name, userId: result.data.userId },
        });
        return;
      }

      const { status, body } = result;

      if (status === 422 && "isValid" in body && body.isValid === false) {
        const fieldUpdates: Partial<typeof errors> = {};
        body.fieldErrors.forEach((fieldError) => {
          const key = SERVER_FIELD_MAP[fieldError.fieldName];
          if (key) fieldUpdates[key] = fieldError.errorMessage;
        });
        setErrors((prev) => ({ ...prev, ...fieldUpdates }));
        return;
      }

      if (status === 422 && "violations" in body) {
        setErrors((prev) => ({ ...prev, password: body.violations.join(" ") }));
        return;
      }

      if (status === 409 && "error_code" in body && body.error_code === "USERNAME_UNAVAILABLE") {
        const hint = body.suggestion_hint ? ` ${body.suggestion_hint}` : "";
        setErrors((prev) => ({ ...prev, username: `${body.message}${hint}` }));
        return;
      }

      setFormError(
        "error" in body && body.error
          ? body.error
          : "Something went wrong. Please try again."
      );
    } catch {
      setFormError("Unable to reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const strengthScore = getStrength(fields.password).level;
  const isFormValid =
    !validate.name(fields.name) &&
    !validate.username(fields.username) &&
    !validate.email(fields.email) &&
    !validate.password(fields.password) &&
    !clientValidate.passwordConfirm(fields.passwordConfirm) &&
    strengthScore >= 1;

  return (
    /* Card container — 480px max-width, 40px padding, 8px radius */
    <div
      className="w-full mx-auto rounded-lg border border-[#E0E0E0] bg-white"
      style={{
        maxWidth: "480px",
        padding: "40px",
        boxShadow: "0px 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <>
          {/* H1 page title */}
          <h1 className="mb-2" style={{ color: "#212121" }}>
            Create Your Account
          </h1>
          <p className="mb-8" style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px" }}>
            Join AuthFlow today — free forever, no credit card needed.
          </p>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            {/* Form-level error banner */}
            {formError && <AuthErrorBanner message={formError} />}

            {/* Full Name */}
            <FormField
              id="reg-name"
              label="Full Name"
              type="text"
              placeholder="Jane Smith"
              value={fields.name}
              onChange={setField("name")}
              onBlur={handleBlur("name")}
              error={touched.name ? errors.name : ""}
              autoComplete="name"
            />

            {/* Username */}
            <FormField
              id="reg-username"
              label="Username"
              type="text"
              placeholder="janesmith"
              value={fields.username}
              onChange={setField("username")}
              onBlur={handleBlur("username")}
              error={touched.username ? errors.username : ""}
              autoComplete="username"
            />

            {/* Email Address */}
            <FormField
              id="reg-email"
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={fields.email}
              onChange={setField("email")}
              onBlur={handleBlur("email")}
              error={touched.email ? errors.email : ""}
              autoComplete="email"
            />

            {/* Password */}
            <div className="flex flex-col gap-0">
              <FormField
                id="reg-password"
                label="Password"
                value={fields.password}
                onChange={setField("password")}
                onBlur={handleBlur("password")}
                error={touched.password ? errors.password : ""}
              >
                <PasswordInput
                  id="reg-password"
                  value={fields.password}
                  onChange={setField("password")}
                  onBlur={handleBlur("password")}
                  hasError={Boolean(touched.password && errors.password)}
                />
              </FormField>

              {/* Password strength bar */}
              <div id="reg-password-strength">
                <PasswordStrengthBar password={fields.password} />
              </div>
            </div>

            {/* Confirm Password */}
            <FormField
              id="reg-password-confirm"
              label="Confirm Password"
              value={fields.passwordConfirm}
              onChange={setField("passwordConfirm")}
              onBlur={handleBlur("passwordConfirm")}
              error={touched.passwordConfirm ? errors.passwordConfirm : ""}
            >
              <PasswordInput
                id="reg-password-confirm"
                value={fields.passwordConfirm}
                onChange={setField("passwordConfirm")}
                onBlur={handleBlur("passwordConfirm")}
                hasError={Boolean(touched.passwordConfirm && errors.passwordConfirm)}
              />
            </FormField>

            {/* Register button — primary, full-width */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-md text-sm font-semibold text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(26,115,232,0.4)] group mt-1 disabled:cursor-not-allowed"
              style={{
                backgroundColor: loading ? "#9E9E9E" : "#1A73E8",
                boxShadow: loading ? "none" : "0px 2px 4px rgba(0,0,0,0.1)",
                letterSpacing: "0.5px",
              }}
              onMouseEnter={(e) => {
                if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1557B0";
              }}
              onMouseLeave={(e) => {
                if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1A73E8";
              }}
              aria-label={loading ? "Creating your account…" : "Register"}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin"
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  Creating account…
                </>
              ) : (
                <>
                  Register
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </>
              )}
            </button>

            {/* Secondary link — "Already have an account? Sign In" */}
            <p
              className="text-center"
              style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px" }}
            >
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/")}
                className="font-medium hover:underline underline-offset-2 transition-colors"
                style={{ color: "#1A73E8", fontSize: "14px" }}
              >
                Sign In
              </button>
            </p>
          </form>
      </>
    </div>
  );
}
