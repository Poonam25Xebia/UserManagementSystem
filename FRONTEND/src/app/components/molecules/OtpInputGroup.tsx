import { OTPInput } from "input-otp";

/* ── Single digit slot — receives data directly as props ── */
interface OtpSlotProps {
  char: string | null;
  hasFakeCaret: boolean;
  isActive: boolean;
  hasError: boolean;
}

function OtpSlot({ char, hasFakeCaret, isActive, hasError }: OtpSlotProps) {
  let borderColor = "#E0E0E0";
  let bgColor     = "#FFFFFF";
  let shadow      = "none";
  let textColor   = "#212121";

  if (hasError) {
    borderColor = "#D32F2F";
    textColor   = "#D32F2F";
  } else if (isActive) {
    borderColor = "#1A73E8";
    shadow      = "0px 0px 0px 2px rgba(26,115,232,0.3)";
  } else if (char) {
    borderColor = "#1A73E8";
    bgColor     = "#F5F5F5";
  }

  return (
    <div
      className="relative flex items-center justify-center rounded-md border transition-all duration-150 select-none"
      style={{
        width: 48,
        height: 56,
        borderColor,
        backgroundColor: bgColor,
        boxShadow: shadow,
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "20px",
        fontWeight: 600,
        lineHeight: "28px",
        color: textColor,
        flexShrink: 0,
      }}
    >
      {char}

      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="animate-caret-blink w-px h-5"
            style={{ backgroundColor: "#1A73E8" }}
          />
        </div>
      )}
    </div>
  );
}

/* ── OtpInputGroup ─────────────────────────────────────── */
interface OtpInputGroupProps {
  value: string;
  onChange: (v: string) => void;
  hasError?: boolean;
  disabled?: boolean;
  onComplete?: (v: string) => void;
}

export function OtpInputGroup({
  value,
  onChange,
  hasError = false,
  disabled = false,
  onComplete,
}: OtpInputGroupProps) {
  return (
    <OTPInput
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      inputMode="numeric"
      pattern="\d*"
      autoFocus
      render={({ slots }) => (
        <div
          className="flex items-center justify-between gap-2 w-full"
          role="group"
          aria-label="6-digit verification code"
        >
          {slots.map((slot, i) => (
            <OtpSlot key={i} {...slot} hasError={hasError} />
          ))}
        </div>
      )}
    />
  );
}
