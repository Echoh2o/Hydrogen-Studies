import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from "@/components/ui/button";
import { Droplets, Menu, X, ChevronDown } from "lucide-react";

export default function SiteHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <Link href="/">
              <div className="flex items-center space-x-2 cursor-pointer">
                <Droplets className="h-8 w-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Hydrogen Studies</span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {/* Studies Dropdown */}
            <div className="relative group">
              <button className="text-gray-700 hover:text-blue-600 transition-colors flex items-center space-x-1">
                <span>Studies</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="p-2 space-y-1">
                  <Link href="/studies" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    All Studies
                  </Link>
                  <Link href="/recent-studies" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    Recent Studies
                  </Link>
                  <Link href="/explore-by-condition" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    By Health Condition
                  </Link>
                  <Link href="/explore-by-body-system" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    By Body System
                  </Link>
                  <Link href="/explore-by-life-stage" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    By Life Stage
                  </Link>
                  <Link href="/explore-by-delivery-method" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    By Delivery Method
                  </Link>
                  <Link href="/explore-by-benefit" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    By Health Benefit
                  </Link>
                  <Link href="/insights" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    Research Insights
                  </Link>
                </div>
              </div>
            </div>
            
            <Link href="/blog" className="text-gray-700 hover:text-blue-600 transition-colors">
              Blog
            </Link>
            <Link href="/benefits" className="text-gray-700 hover:text-blue-600 transition-colors">
              Benefits
            </Link>
            <Link href="/research-analytics" className="text-gray-700 hover:text-blue-600 transition-colors">
              Analytics  
            </Link>
            <Link href="/products" className="text-gray-700 hover:text-blue-600 transition-colors">
              Products
            </Link>
            <Link href="/chat" className="text-gray-700 hover:text-blue-600 transition-colors">
              AI Assistant
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
            <div className="px-4 py-3 space-y-2">
              {/* Studies Section */}
              <div className="border-b pb-2 mb-2">
                <div className="px-4 py-2 text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Studies
                </div>
                <Link href="/studies">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    All Studies
                  </div>
                </Link>
                <Link href="/recent-studies">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Recent Studies
                  </div>
                </Link>
                <Link href="/explore-by-condition">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    By Health Condition
                  </div>
                </Link>
                <Link href="/explore-by-body-system">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    By Body System
                  </div>
                </Link>
                <Link href="/explore-by-life-stage">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    By Life Stage
                  </div>
                </Link>
                <Link href="/explore-by-delivery-method">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    By Delivery Method
                  </div>
                </Link>
                <Link href="/explore-by-benefit">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    By Health Benefit
                  </div>
                </Link>
                <Link href="/insights">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Research Insights
                  </div>
                </Link>
              </div>
              
              <Link href="/blog">
                <div 
                  className="block px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Blog
                </div>
              </Link>
              <Link href="/benefits">
                <div 
                  className="block px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Benefits
                </div>
              </Link>
              <Link href="/research-analytics">
                <div 
                  className="block px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Analytics
                </div>
              </Link>
              <Link href="/products">
                <div 
                  className="block px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Products
                </div>
              </Link>
              <Link href="/chat">
                <div 
                  className="block px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  AI Assistant
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}