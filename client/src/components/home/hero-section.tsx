import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function HeroSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/studies?query=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <section className="bg-primary-gradient text-white py-12 md:py-20">
      <div className="container mx-auto px-4">
        <div className="md:flex md:items-center md:space-x-12">
          <div className="md:w-1/2 mb-8 md:mb-0">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-heading leading-tight mb-4">
              The Complete Database for Hydrogen Research
            </h1>
            <p className="text-lg md:text-xl opacity-90 mb-8">
              Access peer-reviewed studies on molecular hydrogen gas and its health applications.
            </p>
            
            <form onSubmit={handleSearch} className="relative">
              <Input
                type="text"
                placeholder="Search for studies, topics, or keywords..."
                className="w-full px-5 py-6 rounded-lg shadow text-neutral-800 focus:outline-none focus:ring-2 focus:ring-secondary h-auto"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button 
                type="submit"
                variant="ghost" 
                size="icon"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </Button>
            </form>
          </div>
          <div className="md:w-1/2">
            {/* Hydrogen molecule scientific visualization */}
            <svg
              viewBox="0 0 800 600"
              xmlns="http://www.w3.org/2000/svg"
              className="rounded-lg shadow-lg w-full h-auto"
            >
              <defs>
                <radialGradient id="blueGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#1A73E8" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="redGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#EA4335" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="800" height="600" fill="#0D2149" rx="10" ry="10" />
              <g transform="translate(400, 300)">
                {/* Electron orbits */}
                <ellipse cx="0" cy="0" rx="280" ry="120" fill="none" stroke="#1A73E880" strokeWidth="2" transform="rotate(0)" />
                <ellipse cx="0" cy="0" rx="280" ry="120" fill="none" stroke="#1A73E880" strokeWidth="2" transform="rotate(60)" />
                <ellipse cx="0" cy="0" rx="280" ry="120" fill="none" stroke="#1A73E880" strokeWidth="2" transform="rotate(120)" />
                
                {/* Electrons */}
                <circle cx="-280" cy="0" r="20" fill="url(#blueGlow)" />
                <circle cx="280" cy="0" r="20" fill="url(#blueGlow)" />
                <circle cx="-140" cy="-104" r="20" fill="url(#blueGlow)" />
                <circle cx="140" cy="104" r="20" fill="url(#blueGlow)" />
                <circle cx="-140" cy="104" r="20" fill="url(#blueGlow)" />
                <circle cx="140" cy="-104" r="20" fill="url(#blueGlow)" />
                
                {/* Protons */}
                <circle cx="-60" cy="0" r="40" fill="#EA4335" />
                <circle cx="-60" cy="0" r="60" fill="url(#redGlow)" />
                <circle cx="60" cy="0" r="40" fill="#EA4335" />
                <circle cx="60" cy="0" r="60" fill="url(#redGlow)" />
                
                {/* Bond */}
                <line x1="-60" y1="0" x2="60" y2="0" stroke="#ffffff" strokeWidth="8" strokeDasharray="5,5" />
                
                {/* H2 label */}
                <text x="0" y="150" fill="#ffffff" fontSize="60" fontWeight="bold" textAnchor="middle">H₂</text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
