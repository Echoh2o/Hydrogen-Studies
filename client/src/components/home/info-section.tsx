import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Check } from "lucide-react";

export default function InfoSection() {
  return (
    <section className="py-12 bg-neutral-50">
      <div className="container mx-auto px-4">
        <div className="md:flex md:space-x-12 items-center">
          <div className="md:w-1/2 mb-8 md:mb-0">
            {/* SVG visualization of hydrogen molecule */}
            <svg
              viewBox="0 0 800 600"
              xmlns="http://www.w3.org/2000/svg"
              className="rounded-xl shadow-md w-full h-auto"
            >
              <defs>
                <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f8f9fa" />
                  <stop offset="100%" stopColor="#e9ecef" />
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="10" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <rect width="800" height="600" fill="url(#bgGradient)" rx="10" ry="10" />
              
              {/* Grid background */}
              <g stroke="#dee2e6" strokeWidth="1" opacity="0.3">
                {Array.from({ length: 20 }, (_, i) => (
                  <line key={`h-${i}`} x1="0" y1={i * 30} x2="800" y2={i * 30} />
                ))}
                {Array.from({ length: 27 }, (_, i) => (
                  <line key={`v-${i}`} x1={i * 30} y1="0" x2={i * 30} y2="600" />
                ))}
              </g>
              
              {/* Research elements */}
              <g>
                {/* Hydrogen molecule */}
                <circle cx="400" cy="300" r="120" fill="#e3f2fd" opacity="0.6" />
                <circle cx="340" cy="300" r="40" fill="#1A73E8" filter="url(#glow)" />
                <circle cx="460" cy="300" r="40" fill="#1A73E8" filter="url(#glow)" />
                <line x1="340" y1="300" x2="460" y2="300" stroke="#1A73E8" strokeWidth="10" strokeDasharray="5,5" />
                <text x="400" y="300" fill="#0D2149" fontSize="24" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">H₂</text>
                
                {/* Research elements */}
                <g opacity="0.8">
                  <rect x="140" y="100" width="120" height="80" rx="5" fill="#34A853" opacity="0.2" />
                  <text x="200" y="140" fill="#34A853" fontSize="16" textAnchor="middle" dominantBaseline="middle">Antioxidant</text>
                  
                  <rect x="600" y="120" width="140" height="80" rx="5" fill="#EA4335" opacity="0.2" />
                  <text x="670" y="160" fill="#EA4335" fontSize="16" textAnchor="middle" dominantBaseline="middle">Anti-inflammatory</text>
                  
                  <rect x="200" y="450" width="130" height="80" rx="5" fill="#4285F4" opacity="0.2" />
                  <text x="265" y="490" fill="#4285F4" fontSize="16" textAnchor="middle" dominantBaseline="middle">Neuroprotective</text>
                  
                  <rect x="550" y="420" width="120" height="80" rx="5" fill="#FBBC05" opacity="0.2" />
                  <text x="610" y="460" fill="#FBBC05" fontSize="16" textAnchor="middle" dominantBaseline="middle">Metabolic</text>
                </g>
                
                {/* Connection lines */}
                <line x1="210" y1="180" x2="340" y2="280" stroke="#34A853" strokeWidth="2" strokeDasharray="5,5" />
                <line x1="600" y1="200" x2="460" y2="280" stroke="#EA4335" strokeWidth="2" strokeDasharray="5,5" />
                <line x1="270" y1="450" x2="350" y2="340" stroke="#4285F4" strokeWidth="2" strokeDasharray="5,5" />
                <line x1="550" y1="440" x2="450" y2="340" stroke="#FBBC05" strokeWidth="2" strokeDasharray="5,5" />
              </g>
            </svg>
          </div>
          <div className="md:w-1/2">
            <h2 className="text-3xl font-bold font-heading text-neutral-900 mb-4">Understanding Hydrogen Research</h2>
            <p className="text-neutral-600 mb-6">
              Molecular hydrogen (H₂) has emerged as a novel therapeutic agent with potential benefits across various medical conditions. Our database compiles all peer-reviewed studies to help researchers, healthcare providers, and individuals understand the current state of scientific evidence.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="flex items-start">
                <div className="text-primary mr-3 mt-1">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-800 mb-1">Comprehensive</h3>
                  <p className="text-sm text-neutral-600">Complete database of all published hydrogen studies</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="text-primary mr-3 mt-1">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-800 mb-1">Evidence-Based</h3>
                  <p className="text-sm text-neutral-600">Focus on peer-reviewed scientific research</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="text-primary mr-3 mt-1">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-800 mb-1">Up-to-Date</h3>
                  <p className="text-sm text-neutral-600">Regularly updated with newest publications</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="text-primary mr-3 mt-1">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-800 mb-1">User-Friendly</h3>
                  <p className="text-sm text-neutral-600">Designed for researchers and public alike</p>
                </div>
              </div>
            </div>
            <Button className="bg-primary text-white hover:bg-primary/90" asChild>
              <Link href="/about">Learn More About Hydrogen</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
