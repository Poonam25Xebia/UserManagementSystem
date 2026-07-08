import { ArrowRight, ShieldCheck } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";

interface HeroSectionProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export function HeroSection({ onGetStarted, onSignIn }: HeroSectionProps) {
  return (
    <section
      id="home"
      aria-label="Hero section"
      className="relative w-full min-h-[480px] mt-16 flex items-center overflow-hidden bg-white"
    >
      <div className="relative mx-auto w-full max-w-[1200px] px-16 py-16 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left column */}
          <div className="flex flex-col gap-6">
            {/* Trust badge */}
            <div
              className="inline-flex items-center gap-2 w-fit rounded-full px-4 py-2 text-xs font-medium border border-[#E0E0E0] bg-[#F5F5F5]"
              style={{ color: "#9E9E9E", letterSpacing: "0.25px" }}
            >
              <ShieldCheck size={14} style={{ color: "#388E3C" }} aria-hidden="true" />
              Secure · Reliable · Scalable
            </div>

            {/* H1 headline — 32px 700 */}
            <h1 style={{ color: "#212121" }}>
              The Platform Built<br />
              <span style={{ color: "#1A73E8" }}>for Modern Teams</span>
            </h1>

            {/* Subheadline — Body Large 16px 400 */}
            <p
              className="max-w-xl"
              style={{ color: "#9E9E9E", fontSize: "16px", lineHeight: "24px" }}
            >
              Streamline user authentication and management with enterprise-grade
              security. Get onboarded in minutes, scale with confidence, and
              deliver exceptional user experiences from day one.
            </p>

            {/* Dual CTAs */}
            <div
              className="flex flex-wrap gap-3"
              role="group"
              aria-label="Primary actions"
            >
              {/* Get Started — Primary Button */}
              <button
                onClick={onGetStarted}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-semibold text-white bg-[#1A73E8] hover:bg-[#1557B0] active:bg-[#0D47A1] transition-colors duration-150 min-h-[44px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(26,115,232,0.4)] group"
                style={{ boxShadow: "0px 2px 4px rgba(0,0,0,0.1)", letterSpacing: "0.5px" }}
                aria-label="Get started for free"
              >
                Get Started
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>

              {/* Sign In — Secondary (Outlined) Button */}
              <button
                onClick={onSignIn}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-semibold bg-transparent border border-[#1A73E8] text-[#1A73E8] hover:bg-[rgba(26,115,232,0.08)] hover:border-[#1557B0] hover:text-[#1557B0] transition-all duration-150 min-h-[44px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(26,115,232,0.4)]"
                style={{ letterSpacing: "0.5px" }}
                aria-label="Sign in to existing account"
              >
                Sign In
              </button>
            </div>

            {/* Caption micro-copy */}
            <p style={{ color: "#9E9E9E", fontSize: "12px", lineHeight: "16px", letterSpacing: "0.25px" }}>
              No credit card required · Free 14-day trial
            </p>
          </div>

          {/* Right column — hero image */}
          <div className="relative flex items-center justify-center lg:justify-end">
            <div className="relative w-full max-w-lg lg:max-w-none">
              <div
                className="relative rounded-lg overflow-hidden border border-[#E0E0E0]"
                style={{ boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.08)" }}
              >
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBzb2Z0d2FyZSUyMHBsYXRmb3JtJTIwZGFzaGJvYXJkJTIwaW50ZXJmYWNlfGVufDF8fHx8MTc4Mjk4NjYwNHww&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Analytics dashboard showing platform performance metrics"
                  className="w-full h-auto object-cover aspect-[4/3]"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
