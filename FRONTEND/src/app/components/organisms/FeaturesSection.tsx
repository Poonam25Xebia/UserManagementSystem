import {
  ShieldCheck,
  Zap,
  Users,
  Lock,
  BarChart3,
  Globe,
} from "lucide-react";
import { FeatureCard } from "../molecules/FeatureCard";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Enterprise-Grade Security",
    description:
      "Bank-level encryption and multi-factor authentication protect every account by default, giving users the confidence to trust your platform.",
    iconColor: "#388E3C",
    iconBg: "rgba(56, 142, 60, 0.1)",
  },
  {
    icon: Zap,
    title: "Instant Onboarding",
    description:
      "Streamlined registration with OTP verification gets users authenticated in under 60 seconds — no friction, no drop-off.",
    iconColor: "#FF6D00",
    iconBg: "rgba(255, 109, 0, 0.1)",
  },
  {
    icon: Users,
    title: "Unified User Management",
    description:
      "View, manage, and control every user account across your organisation from one powerful dashboard.",
    iconColor: "#1A73E8",
    iconBg: "rgba(26, 115, 232, 0.1)",
  },
  {
    icon: Lock,
    title: "Granular Access Control",
    description:
      "Define roles, permissions, and policies with precision. Ensure the right people have the right access at all times.",
    iconColor: "#00897B",
    iconBg: "rgba(0, 137, 123, 0.1)",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description:
      "Monitor authentication events, session activity, and user behaviour with live dashboards and exportable reports.",
    iconColor: "#D32F2F",
    iconBg: "rgba(211, 47, 47, 0.1)",
  },
  {
    icon: Globe,
    title: "Global Scalability",
    description:
      "Architected on distributed infrastructure to support millions of users worldwide with sub-100ms latency and zero downtime.",
    iconColor: "#1A73E8",
    iconBg: "rgba(26, 115, 232, 0.08)",
  },
];

export function FeaturesSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="w-full py-16 md:py-20"
      style={{ backgroundColor: "#F5F5F5" }}
    >
      <div className="mx-auto max-w-[1200px] px-16">
        {/* Section header */}
        <div className="text-center mb-12">
          {/* Caption label */}
          <p
            className="mb-3"
            style={{
              color: "#1A73E8",
              fontSize: "12px",
              fontWeight: 600,
              lineHeight: "16px",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            Why Choose Us
          </p>

          {/* H2 heading */}
          <h2
            id="features-heading"
            style={{ color: "#212121" }}
            className="mb-4"
          >
            Everything your platform needs
          </h2>

          {/* Body Large description */}
          <p
            className="max-w-2xl mx-auto"
            style={{ color: "#9E9E9E", fontSize: "16px", lineHeight: "24px" }}
          >
            Purpose-built features that remove complexity so you can focus on
            growing your product and delighting your users.
          </p>
        </div>

        {/* 3-column feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
