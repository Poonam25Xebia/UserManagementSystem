import { AlertTriangle } from "lucide-react";

interface WarningBannerProps {
  title?: string;
  message: string;
  variant?: "warning" | "danger";
}

export function WarningBanner({ title = "WARNING", message, variant = "warning" }: WarningBannerProps) {
  const isDanger  = variant === "danger";
  const bg        = isDanger ? "#FFEBEE" : "#FFF8E1";
  const border    = isDanger ? "#D32F2F" : "#FBC02D";
  const iconColor = isDanger ? "#D32F2F" : "#F57F17";
  const titleClr  = isDanger ? "#B71C1C" : "#F57F17";
  const textClr   = isDanger ? "#B71C1C" : "#795900";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex gap-3 rounded-lg border px-5 py-4"
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <AlertTriangle
        size={20}
        className="flex-shrink-0 mt-0.5"
        style={{ color: iconColor }}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-0.5">
        {title && (
          <p style={{ color: titleClr, fontSize: "13px", fontWeight: 700, lineHeight: "18px", letterSpacing: "0.5px", textTransform: "uppercase" }}>
            {title}
          </p>
        )}
        <p style={{ color: textClr, fontSize: "14px", lineHeight: "20px" }}>
          {message}
        </p>
      </div>
    </div>
  );
}
