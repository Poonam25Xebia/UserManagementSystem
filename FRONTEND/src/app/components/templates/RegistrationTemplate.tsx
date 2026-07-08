import { useNavigate } from "react-router";
import { Header } from "../organisms/Header";
import { RegistrationForm } from "../organisms/RegistrationForm";
import { Footer } from "../organisms/Footer";

const NAV_ITEMS = [
  { label: "Home",     href: "/"          },
  { label: "Features", href: "/#features" },
  { label: "About",    href: "/#about"    },
];

export function RegistrationTemplate() {
  const navigate = useNavigate();

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ fontFamily: "'Inter','SF Pro Text','Roboto',sans-serif", backgroundColor: "#F5F5F5" }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 z-[100] px-4 py-2 rounded-md bg-[#1A73E8] text-white text-sm font-medium"
      >
        Skip to main content
      </a>

      <Header
        onSignIn={() => navigate("/login")}
        onRegister={() => {
          document.getElementById("registration-card")?.scrollIntoView({ behavior: "smooth" });
        }}
        navItems={NAV_ITEMS}
      />

      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-4 sm:px-6"
        style={{ paddingTop: "calc(64px + 48px)", paddingBottom: "48px" }}
      >
        <div id="registration-card" className="w-full flex justify-center">
          <RegistrationForm />
        </div>
      </main>

      <Footer />
    </div>
  );
}
