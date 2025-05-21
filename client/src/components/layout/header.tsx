import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown } from "lucide-react";

const navigationLinks = [
  { href: "/", label: "Home" },
  { 
    href: "/studies",
    label: "Studies",
    id: "studies-menu"
  },
  { 
    href: "/categories",
    label: "Categories",
    id: "categories-menu"
  },
  {
    href: "/explore-by-condition",
    label: "Explore",
    id: "explore-menu",
    dropdown: [
      { href: "/benefits", label: "Health Benefits" },
      { href: "/explore-by-condition", label: "Health Conditions" },
      { href: "/explore-by-body-system", label: "Body Systems" },
      { href: "/explore-by-life-stage", label: "Life Stages" }
    ]
  },
  { href: "/improved-search", label: "Search", id: "search-menu" },
  { href: "/chat", label: "AI Assistant", id: "chat-menu" },
  { href: "/about", label: "About" }
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRefs = useRef<{[key: string]: HTMLDivElement | null}>({});

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const toggleDropdown = (label: string) => {
    if (openDropdown === label) {
      setOpenDropdown(null);
    } else {
      setOpenDropdown(label);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (openDropdown && dropdownRefs.current[openDropdown] && 
          !dropdownRefs.current[openDropdown]?.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdown]);

  return (
    <header className="bg-white shadow-md sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-3">
          <div className="flex items-center space-x-4">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <svg
                width="42"
                height="42"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mr-3"
              >
                <circle cx="20" cy="20" r="18" fill="#E3F2FD" />
                <circle cx="14" cy="20" r="6" fill="#1A73E8" />
                <circle cx="26" cy="20" r="6" fill="#34A853" />
              </svg>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-primary">
                  Hydrogen<span className="text-secondary">Studies</span>
                </span>
                <span className="text-xs text-gray-500 -mt-1">Research Database</span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navigationLinks.map((link) => (
              <div 
                key={link.id || link.href} 
                className="relative"
                ref={(el) => { if (link.dropdown) dropdownRefs.current[link.label] = el; }}
              >
                {link.dropdown ? (
                  <>
                    <button
                      onClick={() => toggleDropdown(link.label)}
                      className={`flex items-center px-2 py-1 rounded-md text-neutral-700 hover:text-primary hover:bg-slate-50 font-medium transition-colors ${openDropdown === link.label ? 'text-primary bg-slate-50' : ''}`}
                    >
                      {link.label} 
                      <ChevronDown className={`ml-1 h-4 w-4 transform transition-transform ${openDropdown === link.label ? 'rotate-180' : ''}`} />
                    </button>
                    {openDropdown === link.label && (
                      <div className="absolute left-0 mt-2 w-60 rounded-md shadow-xl bg-white ring-1 ring-slate-200 z-50">
                        <div className="py-1" role="menu" aria-orientation="vertical">
                          {link.dropdown.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              className="block px-4 py-2.5 text-sm text-neutral-700 hover:bg-blue-50 hover:text-primary transition-colors duration-150"
                              onClick={() => setOpenDropdown(null)}
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={link.href}
                    className="text-neutral-700 hover:text-primary font-medium"
                  >
                    {link.label}
                  </Link>
                )}
              </div>
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
              <div key={link.id || link.href}>
                {link.dropdown ? (
                  <div className="py-2">
                    <button
                      onClick={() => toggleDropdown(link.label)}
                      className="flex items-center justify-between w-full text-neutral-700 hover:text-primary font-medium"
                    >
                      {link.label}
                      <ChevronDown className={`h-4 w-4 transition-transform ${openDropdown === link.label ? 'rotate-180' : ''}`} />
                    </button>
                    {openDropdown === link.label && (
                      <div className="pl-4 mt-2 space-y-2.5 border-l-2 border-blue-100">
                        {link.dropdown.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="block py-1.5 text-neutral-600 hover:text-primary transition-colors duration-150"
                            onClick={() => {
                              setOpenDropdown(null);
                              setMobileMenuOpen(false);
                            }}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    href={link.href}
                    className="text-neutral-700 hover:text-primary py-2 px-1 font-medium block"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
