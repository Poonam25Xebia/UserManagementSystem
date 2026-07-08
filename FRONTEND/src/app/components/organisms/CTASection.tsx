import { ArrowRight } from "lucide-react";

interface CTASectionProps {
  onRegister: () => void;
  onSignIn: () => void;
}

export function CTASection({ onRegister, onSignIn }: CTASectionProps) {
  return (
    <section
      id="cta"
      aria-labelledby="cta-heading"
      className="w-full py-16 md:py-20 bg-white"
    >
      <div className="mx-auto max-w-[1200px] px-16">
        {/* Centered container — max-width 600px */}
        <div className="mx-auto max-w-[600px] text-center">
          {/* H2 section heading */}
          <h2
            id="cta-heading"
            className="mb-4"
            style={{ color: "#212121" }}
          >
            Join the Platform
          </h2>

          {/* Body Large supporting copy */}
          <p
            className="mb-8"
            style={{ color: "#9E9E9E", fontSize: "16px", lineHeight: "24px" }}
          >
            Start your free trial today — no credit card required. Create an
            account in seconds or sign in if you're already a member.
          </p>

          {/* Dual CTA buttons — inline */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
            role="group"
            aria-label="Account actions"
          >
            {/* Register Now — Primary Button */}
            <button
              onClick={onRegister}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-semibold text-white bg-[#1A73E8] hover:bg-[#1557B0] active:bg-[#0D47A1] transition-colors duration-150 w-full sm:w-auto min-h-[44px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(26,115,232,0.4)] group"
              style={{ boxShadow: "0px 2px 4px rgba(0,0,0,0.1)", letterSpacing: "0.5px" }}
              aria-label="Create a new account"
            >
              Register Now
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>

            {/* Sign In — Secondary (Outlined) Button */}
            <button
              onClick={onSignIn}
              className="inline-flex items-center justify-center px-6 py-3 rounded-md text-sm font-semibold bg-transparent border border-[#1A73E8] text-[#1A73E8] hover:bg-[rgba(26,115,232,0.08)] hover:border-[#1557B0] hover:text-[#1557B0] transition-all duration-150 w-full sm:w-auto min-h-[44px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(26,115,232,0.4)]"
              style={{ letterSpacing: "0.5px" }}
              aria-label="Sign in to existing account"
            >
              Sign In
            </button>
          </div>

          {/* Supporting micro copy — Caption */}
          <p
            className="mt-5"
            style={{ color: "#9E9E9E", fontSize: "12px", lineHeight: "16px", letterSpacing: "0.25px" }}
          >
            Already have an account?{" "}
            <button
              onClick={onSignIn}
              className="font-medium text-[#1A73E8] hover:text-[#1557B0] hover:underline underline-offset-2 transition-colors"
              style={{ fontSize: "12px" }}
            >
              Sign in here
            </button>
            . Need help?{" "}
            <a
              href="#"
              className="font-medium text-[#1A73E8] hover:text-[#1557B0] underline-offset-2"
              style={{ fontSize: "12px" }}
            >
              Contact support
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
