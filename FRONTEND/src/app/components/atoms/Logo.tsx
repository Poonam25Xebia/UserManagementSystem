import { Layers } from "lucide-react";

interface LogoProps {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  href?: string;
}

export function Logo({ variant = "dark", size = "md", href = "/" }: LogoProps) {
  const iconSizes = { sm: 16, md: 20, lg: 24 };
  const textStyles = {
    sm: { fontSize: "14px", fontWeight: 700, lineHeight: "20px" },
    md: { fontSize: "18px", fontWeight: 700, lineHeight: "24px" },
    lg: { fontSize: "22px", fontWeight: 700, lineHeight: "28px" },
  };
  const containerSizes = { sm: 28, md: 32, lg: 40 };

  const textColor = variant === "light" ? "#FFFFFF" : "#212121";

  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(26,115,232,0.4)] rounded-sm"
      aria-label="AuthFlow — go to homepage"
      style={{ textDecoration: "none" }}
    >
      <span
        className="inline-flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ width: containerSizes[size], height: containerSizes[size], backgroundColor: "#1A73E8" }}
        aria-hidden="true"
      >
        <Layers size={iconSizes[size]} color="#FFFFFF" strokeWidth={2} />
      </span>
      <span style={{ ...textStyles[size], color: textColor, letterSpacing: "-0.25px" }}>
        AuthFlow
      </span>
    </a>
  );
}
