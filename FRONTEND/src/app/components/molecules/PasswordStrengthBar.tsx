interface PasswordStrengthBarProps {
  password: string;
}

type Strength = { level: 0 | 1 | 2 | 3; label: string; color: string };

function getStrength(password: string): Strength {
  if (!password) return { level: 0, label: "", color: "#E0E0E0" };

  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: "Weak", color: "#D32F2F" };
  if (score <= 2) return { level: 2, label: "Fair", color: "#FBC02D" };
  return { level: 3, label: "Strong", color: "#388E3C" };
}

export function PasswordStrengthBar({ password }: PasswordStrengthBarProps) {
  const { level, label, color } = getStrength(password);

  if (!password) return null;

  return (
    <div className="flex flex-col gap-1.5 mt-1" aria-live="polite" aria-atomic="true">
      {/* Three-segment bar */}
      <div className="flex gap-1.5" role="img" aria-label={`Password strength: ${label}`}>
        {[1, 2, 3].map((seg) => (
          <div
            key={seg}
            className="h-1 flex-1 rounded-full transition-colors duration-300"
            style={{
              backgroundColor: seg <= level ? color : "#E0E0E0",
            }}
          />
        ))}
      </div>

      {/* Label */}
      <p
        className="text-right"
        style={{
          color,
          fontSize: "12px",
          lineHeight: "16px",
          letterSpacing: "0.25px",
          fontWeight: 500,
        }}
      >
        {label}
      </p>
    </div>
  );
}

/* Export helper for consumers that need the raw score */
export { getStrength };
