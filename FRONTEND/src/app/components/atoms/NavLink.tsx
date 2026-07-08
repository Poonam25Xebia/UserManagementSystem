interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function NavLink({ href, children, className = "", onClick }: NavLinkProps) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={`text-sm font-medium leading-5 text-[#1A73E8] hover:text-[#1557B0] hover:underline underline-offset-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(26,115,232,0.4)] rounded-sm ${className}`}
    >
      {children}
    </a>
  );
}
