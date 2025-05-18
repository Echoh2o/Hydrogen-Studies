import { useState } from "react";
import { Link, useLocation } from "wouter";
import { HiMenu, HiX } from "react-icons/hi";
import { Button } from "@/components/ui/button";
import logoPath from "../../assets/hydrogen-studies-logo.svg";

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isActiveLink = (path: string) => {
    return location === path;
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Site Title */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <img 
                src="./src/assets/hydrogen-studies-logo.svg" 
                alt="Hydrogen Studies Research Database" 
                className="h-12 mr-3"
              />
              <div className="flex flex-col">
                <span className="text-xl font-bold text-primary leading-tight">HydrogenStudies</span>
                <span className="text-xs text-neutral-600">Part of the EchoWater Ecosystem</span>
              </div>
            </Link>
          </div>

          {/* Mobile Navigation Toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleMobileMenu}
            className="md:hidden"
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? (
              <HiX className="text-xl text-neutral-700" />
            ) : (
              <HiMenu className="text-xl text-neutral-700" />
            )}
          </Button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            <Link href="/">
              <a className={`px-3 py-2 font-medium rounded-md ${isActiveLink('/') ? 'text-primary' : 'text-neutral-800 hover:text-primary'}`}>
                Home
              </a>
            </Link>
            <Link href="/benefits">
              <a className={`px-3 py-2 font-medium rounded-md ${isActiveLink('/benefits') || location.startsWith('/benefits/') ? 'text-primary' : 'text-neutral-800 hover:text-primary'}`}>
                Benefits
              </a>
            </Link>
            <Link href="/studies">
              <a className={`px-3 py-2 font-medium rounded-md ${isActiveLink('/studies') ? 'text-primary' : 'text-neutral-800 hover:text-primary'}`}>
                All Studies
              </a>
            </Link>
            <Link href="/about">
              <a className={`px-3 py-2 font-medium rounded-md ${isActiveLink('/about') ? 'text-primary' : 'text-neutral-800 hover:text-primary'}`}>
                About
              </a>
            </Link>
            <Link href="/chat">
              <a className={`px-3 py-2 font-medium rounded-md ${isActiveLink('/chat') ? 'text-primary' : 'text-neutral-800 hover:text-primary'}`}>
                Ask AI
              </a>
            </Link>
            <Link href="/contact">
              <a className={`px-3 py-2 font-medium rounded-md ${isActiveLink('/contact') ? 'text-primary' : 'text-neutral-800 hover:text-primary'}`}>
                Contact
              </a>
            </Link>
          </nav>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b shadow-lg">
          <div className="container mx-auto px-4 py-2">
            <nav className="flex flex-col space-y-2 py-3">
              <Link href="/">
                <a 
                  className={`px-3 py-2 font-medium rounded-md ${isActiveLink('/') ? 'text-primary' : 'text-neutral-800 hover:text-primary'}`}
                  onClick={closeMobileMenu}
                >
                  Home
                </a>
              </Link>
              <Link href="/benefits">
                <a 
                  className={`px-3 py-2 font-medium rounded-md ${isActiveLink('/benefits') || location.startsWith('/benefits/') ? 'text-primary' : 'text-neutral-800 hover:text-primary'}`}
                  onClick={closeMobileMenu}
                >
                  Benefits
                </a>
              </Link>
              <Link href="/studies">
                <a 
                  className={`px-3 py-2 font-medium rounded-md ${isActiveLink('/studies') ? 'text-primary' : 'text-neutral-800 hover:text-primary'}`}
                  onClick={closeMobileMenu}
                >
                  All Studies
                </a>
              </Link>
              <Link href="/about">
                <a 
                  className={`px-3 py-2 font-medium rounded-md ${isActiveLink('/about') ? 'text-primary' : 'text-neutral-800 hover:text-primary'}`}
                  onClick={closeMobileMenu}
                >
                  About
                </a>
              </Link>
              <Link href="/chat">
                <a 
                  className={`px-3 py-2 font-medium rounded-md ${isActiveLink('/chat') ? 'text-primary' : 'text-neutral-800 hover:text-primary'}`}
                  onClick={closeMobileMenu}
                >
                  Ask AI
                </a>
              </Link>
              <Link href="/contact">
                <a 
                  className={`px-3 py-2 font-medium rounded-md ${isActiveLink('/contact') ? 'text-primary' : 'text-neutral-800 hover:text-primary'}`}
                  onClick={closeMobileMenu}
                >
                  Contact
                </a>
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
