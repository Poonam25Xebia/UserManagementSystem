import { AlertCircle } from "lucide-react";

interface FormFieldProps {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  children?: React.ReactNode; /* allows swapping input (e.g. password) */
}

export function FormField({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  autoComplete,
  required = true,
  hint,
  children,
}: FormFieldProps) {
  const hasError = Boolean(error);

  const inputClass = [
    "w-full h-12 px-4 rounded-md border text-sm text-[#212121] placeholder:text-[#9E9E9E] bg-white",
    "transition-all duration-150 outline-none",
    hasError
      ? "border-[#D32F2F] focus:border-[#D32F2F] focus:ring-[3px] focus:ring-[rgba(211,47,47,0.2)]"
      : "border-[#E0E0E0] focus:border-[#1A73E8] focus:ring-[3px] focus:ring-[rgba(26,115,232,0.2)]",
  ].join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label */}
      <label
        htmlFor={id}
        style={{ color: "#212121", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}
      >
        {label}
        {required && (
          <span className="ml-0.5" style={{ color: "#D32F2F" }} aria-hidden="true">
            *
          </span>
        )}
      </label>

      {/* Input — use children slot for custom inputs (e.g. PasswordInput) */}
      {children ? (
        <div data-error={hasError}>{children}</div>
      ) : (
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={inputClass}
        />
      )}

      {/* Hint text */}
      {hint && !hasError && (
        <p id={`${id}-hint`} style={{ color: "#9E9E9E", fontSize: "12px", lineHeight: "16px", letterSpacing: "0.25px" }}>
          {hint}
        </p>
      )}

      {/* Error message */}
      {hasError && (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-center gap-1"
          style={{ color: "#D32F2F", fontSize: "12px", lineHeight: "16px", letterSpacing: "0.25px" }}
        >
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
