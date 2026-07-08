import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";

const RESEND_COOLDOWN = 30; /* seconds before Resend is re-enabled */

interface CountdownResendProps {
  onResend: () => void;
  disabled?: boolean; /* externally controlled disable (e.g. during verify) */
}

export function CountdownResend({ onResend, disabled = false }: CountdownResendProps) {
  const [seconds, setSeconds] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);

  /* Count down every second */
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  /* Format mm:ss */
  const formatted = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const canResend = seconds <= 0 && !disabled && !resending;

  const handleResend = useCallback(async () => {
    if (!canResend) return;
    setResending(true);
    await new Promise((r) => setTimeout(r, 800)); /* simulate API */
    setResending(false);
    setSeconds(RESEND_COOLDOWN);
    onResend();
  }, [canResend, onResend]);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Helper text */}
      <p style={{ color: "#9E9E9E", fontSize: "14px", lineHeight: "20px" }}>
        Didn't receive it?
      </p>

      {/* Countdown or Resend link */}
      {seconds > 0 ? (
        /* Disabled state with timer */
        <p style={{ fontSize: "14px", lineHeight: "20px" }}>
          <span style={{ color: "#9E9E9E" }}>Resend OTP in </span>
          <span
            className="font-semibold tabular-nums"
            style={{ color: "#FF6D00" /* Accent Orange — OTP expiry warning */ }}
            aria-live="polite"
            aria-atomic="true"
            aria-label={`Resend available in ${formatted}`}
          >
            {formatted}
          </span>
        </p>
      ) : (
        /* Active resend link */
        <button
          type="button"
          onClick={handleResend}
          disabled={!canResend}
          className="inline-flex items-center gap-1.5 font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(26,115,232,0.4)] rounded-sm"
          style={{
            color: canResend ? "#1A73E8" : "#9E9E9E",
            fontSize: "14px",
            lineHeight: "20px",
            cursor: canResend ? "pointer" : "not-allowed",
          }}
          aria-label="Resend OTP code"
        >
          <RefreshCw
            size={14}
            className={resending ? "animate-spin" : ""}
            aria-hidden="true"
          />
          {resending ? "Sending…" : "Resend OTP"}
        </button>
      )}

      {/* Spam-folder hint — Caption */}
      <p
        className="text-center max-w-xs"
        style={{
          color: "#9E9E9E",
          fontSize: "12px",
          lineHeight: "16px",
          letterSpacing: "0.25px",
        }}
      >
        Check your spam folder if you don't see it in your inbox.
      </p>
    </div>
  );
}
