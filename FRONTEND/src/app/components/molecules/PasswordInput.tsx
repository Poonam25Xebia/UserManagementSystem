import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps {
  id: string;
  placeholder?: string;
  autoComplete?: string;
  value?: string;
  onChange?: (v: string) => void;
  onBlur?: () => void;
  hasError?: boolean;
  required?: boolean;
}

export function PasswordInput({
  id,
  placeholder = "••••••••",
  autoComplete = "current-password",
  value,
  onChange,
  onBlur,
  hasError = false,
  required = true,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  const inputClass = [
    "w-full h-12 px-4 pr-12 rounded-md border text-sm text-[#212121] placeholder:text-[#9E9E9E] bg-white",
    "transition-all duration-150 outline-none",
    hasError
      ? "border-[#D32F2F] focus:border-[#D32F2F] focus:ring-[3px] focus:ring-[rgba(211,47,47,0.2)]"
      : "border-[#E0E0E0] focus:border-[#1A73E8] focus:ring-[3px] focus:ring-[rgba(26,115,232,0.2)]",
  ].join(" ");

  /* Controlled or uncontrolled */
  const inputProps = onChange
    ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) }
    : {};

  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        aria-invalid={hasError}
        onBlur={onBlur}
        className={inputClass}
        {...inputProps}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#9E9E9E] hover:text-[#212121] transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}
