import { useState } from "react";
import { Link, useLocation } from "wouter";
import { HiMenu, HiX } from "react-icons/hi";
import { Brain, Droplet, Users, Zap, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
            
            {/* Explore Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <a className={`px-3 py-2 font-medium rounded-md flex items-center cursor-pointer ${
                  location.startsWith('/benefits') || 
                  location.startsWith('/demographics') || 
                  location.startsWith('/mechanisms') || 
                  location.startsWith('/delivery-methods') 
                  ? 'text-primary' 
                  : 'text-neutral-800 hover:text-primary'
                }`}>
                  Explore <ChevronDown className="ml-1 h-4 w-4" />
                </a>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <Link href="/benefits">
                  <DropdownMenuItem className="cursor-pointer">
                    <Brain className="mr-2 h-4 w-4" />
                    <span>By Health Benefit</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/demographics">
                  <DropdownMenuItem className="cursor-pointer">
                    <Users className="mr-2 h-4 w-4" />
                    <span>By Demographic</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/mechanisms">
                  <DropdownMenuItem className="cursor-pointer">
                    <Zap className="mr-2 h-4 w-4" />
                    <span>By Mechanism</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/delivery-methods">
                  <DropdownMenuItem className="cursor-pointer">
                    <Droplet className="mr-2 h-4 w-4" />
                    <span>By Delivery Method</span>
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
            
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
              
              <div className="px-3 py-2 font-medium text-neutral-800">
                <div className="mb-1 font-semibold">Explore Studies By:</div>
                <div className="ml-2 space-y-2 mt-2">
                  <Link href="/benefits">
                    <a 
                      className={`flex items-center ${isActiveLink('/benefits') || location.startsWith('/benefits/') ? 'text-primary' : 'text-neutral-700 hover:text-primary'}`}
                      onClick={closeMobileMenu}
                    >
                      <Brain className="mr-2 h-4 w-4" />
                      Health Benefits
                    </a>
                  </Link>
                  <Link href="/demographics">
                    <a 
                      className={`flex items-center ${isActiveLink('/demographics') || location.startsWith('/demographics/') ? 'text-primary' : 'text-neutral-700 hover:text-primary'}`}
                      onClick={closeMobileMenu}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Demographics
                    </a>
                  </Link>
                  <Link href="/mechanisms">
                    <a 
                      className={`flex items-center ${isActiveLink('/mechanisms') || location.startsWith('/mechanisms/') ? 'text-primary' : 'text-neutral-700 hover:text-primary'}`}
                      onClick={closeMobileMenu}
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      Mechanisms
                    </a>
                  </Link>
                  <Link href="/delivery-methods">
                    <a 
                      className={`flex items-center ${isActiveLink('/delivery-methods') || location.startsWith('/delivery-methods/') ? 'text-primary' : 'text-neutral-700 hover:text-primary'}`}
                      onClick={closeMobileMenu}
                    >
                      <Droplet className="mr-2 h-4 w-4" />
                      Delivery Methods
                    </a>
                  </Link>
                </div>
              </div>
              
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
