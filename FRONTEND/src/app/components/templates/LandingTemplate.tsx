import { useNavigate } from "react-router";
import { Header } from "../organisms/Header";
import { HeroSection } from "../organisms/HeroSection";
import { FeaturesSection } from "../organisms/FeaturesSection";
import { CTASection } from "../organisms/CTASection";
import { Footer } from "../organisms/Footer";

export function LandingTemplate() {
  const navigate = useNavigate();

  const goToRegister = () => navigate("/register");
  const goToLogin    = () => navigate("/login");

  const navItems = [
    { label: "Home",     href: "#home"     },
    { label: "Features", href: "#features" },
    { label: "About",    href: "#about"    },
  ];

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ fontFamily: "'Inter','SF Pro Text','Roboto',sans-serif" }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 z-[100] px-4 py-2 rounded-md bg-[#1A73E8] text-white text-sm font-medium"
      >
        Skip to main content
      </a>

      <Header onSignIn={goToLogin} onRegister={goToRegister} navItems={navItems} />

      <main className="flex-1" id="main-content">
        <HeroSection onGetStarted={goToRegister} onSignIn={goToLogin} />
        <FeaturesSection />
        <CTASection onRegister={goToRegister} onSignIn={goToLogin} />
      </main>

      <Footer />
    </div>
  );
}
