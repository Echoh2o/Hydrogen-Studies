import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

const navigationLinks = [
  { href: "/", label: "Home" },
  { href: "/studies", label: "Studies" },
  { href: "/categories", label: "Categories" },
  { href: "/resources", label: "Resources" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mr-3"
              >
                <circle cx="20" cy="20" r="18" fill="#E3F2FD" />
                <circle cx="14" cy="20" r="6" fill="#1A73E8" />
                <circle cx="26" cy="20" r="6" fill="#34A853" />
              </svg>
              <span className="text-xl font-bold text-primary">
                Hydrogen<span className="text-secondary">Studies</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navigationLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-neutral-700 hover:text-primary font-medium"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Mobile Navigation Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMobileMenu}
            className="md:hidden text-neutral-700 hover:text-primary"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white px-4 py-2 pb-4 border-t border-neutral-200">
          <nav className="flex flex-col space-y-3">
            {navigationLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-neutral-700 hover:text-primary py-2 px-1 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
