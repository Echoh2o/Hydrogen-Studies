import React from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X, Search, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

function Header() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);
  const [studiesExpanded, setStudiesExpanded] = React.useState(false);

  const navigation = [
    { name: 'Learn', href: '/learn' },
    { name: 'Blog', href: '/blog' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' }
  ];

  const studiesDropdownItems = [
    { name: 'All Studies', href: '/studies' },
    { name: 'Recent Studies', href: '/recent-studies' },
    { name: 'By Health Condition', href: '/explore-by-condition' },
    { name: 'By Body System', href: '/explore-by-body-system' },
    { name: 'By Life Stage', href: '/explore-by-life-stage' },
    { name: 'By Delivery Method', href: '/explore-by-delivery-method' },
    { name: 'By Health Benefit', href: '/explore-by-benefit' },
    { name: 'Research Insights', href: '/insights' },
  ];

  const isActive = (href: string) => {
    if (href === '/' && location === '/') return true;
    if (href !== '/' && location.startsWith(href)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">H₂</span>
              </div>
              <span className="font-bold text-xl text-gray-900">HydrogenStudies</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {/* Studies Link for Desktop */}
            <Link
              href="/studies"
              className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                location.startsWith('/studies') || location.startsWith('/explore') || location === '/insights'
                  ? 'text-blue-600 border-b-2 border-blue-600 pb-1' 
                  : 'text-gray-700'
              }`}
            >
              Studies
            </Link>

            {/* Regular Navigation Items */}
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                  isActive(item.href) 
                    ? 'text-blue-600 border-b-2 border-blue-600 pb-1' 
                    : 'text-gray-700'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/search">
              <Button variant="ghost" size="sm" className="text-gray-700 hover:text-blue-600">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                <MessageCircle className="h-4 w-4 mr-2" />
                Ask AI
              </Button>
            </Link>
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md text-gray-700 hover:text-blue-600"
              aria-label="Toggle menu"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Mobile Menu Overlay */}
            {isOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-black bg-opacity-25" onClick={() => setIsOpen(false)} />
                <div className="fixed top-0 right-0 z-50 h-full w-80 bg-white shadow-xl">
                  <div className="flex items-center justify-between p-4 border-b">
                    <span className="text-lg font-semibold">Menu</span>
                    <button 
                      onClick={() => setIsOpen(false)}
                      className="p-2 rounded-md text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="flex flex-col p-4 space-y-4">
                    {/* Studies Section */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setStudiesExpanded(!studiesExpanded)}
                        className="flex items-center justify-between w-full text-left text-lg font-semibold text-gray-900 py-2 border-b"
                      >
                        Studies
                        {studiesExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </button>
                      {studiesExpanded && (
                        <div className="pl-4 space-y-2">
                          <Link href="/studies" onClick={() => setIsOpen(false)} className="block py-2 text-gray-600 hover:text-blue-600">
                            All Studies
                          </Link>
                          <Link href="/recent-studies" onClick={() => setIsOpen(false)} className="block py-2 text-gray-600 hover:text-blue-600">
                            Recent Studies
                          </Link>
                          <Link href="/explore-by-condition" onClick={() => setIsOpen(false)} className="block py-2 text-gray-600 hover:text-blue-600">
                            By Health Condition
                          </Link>
                          <Link href="/explore-by-body-system" onClick={() => setIsOpen(false)} className="block py-2 text-gray-600 hover:text-blue-600">
                            By Body System
                          </Link>
                          <Link href="/explore-by-life-stage" onClick={() => setIsOpen(false)} className="block py-2 text-gray-600 hover:text-blue-600">
                            By Life Stage
                          </Link>
                          <Link href="/explore-by-delivery-method" onClick={() => setIsOpen(false)} className="block py-2 text-gray-600 hover:text-blue-600">
                            By Delivery Method
                          </Link>
                          <Link href="/explore-by-benefit" onClick={() => setIsOpen(false)} className="block py-2 text-gray-600 hover:text-blue-600">
                            By Health Benefit
                          </Link>
                          <Link href="/insights" onClick={() => setIsOpen(false)} className="block py-2 text-gray-600 hover:text-blue-600">
                            Research Insights
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Other Navigation */}
                    <Link href="/learn" onClick={() => setIsOpen(false)} className="text-lg font-medium py-2 text-gray-700 hover:text-blue-600">
                      Learn
                    </Link>
                    <Link href="/blog" onClick={() => setIsOpen(false)} className="text-lg font-medium py-2 text-gray-700 hover:text-blue-600">
                      Blog
                    </Link>
                    <Link href="/about" onClick={() => setIsOpen(false)} className="text-lg font-medium py-2 text-gray-700 hover:text-blue-600">
                      About
                    </Link>
                    <Link href="/contact" onClick={() => setIsOpen(false)} className="text-lg font-medium py-2 text-gray-700 hover:text-blue-600">
                      Contact
                    </Link>

                    <div className="border-t pt-4 space-y-2">
                      <Link href="/search" onClick={() => setIsOpen(false)}>
                        <button className="w-full flex items-center justify-start px-4 py-2 text-left bg-gray-100 rounded-lg hover:bg-gray-200">
                          <Search className="h-4 w-4 mr-2" />
                          Search Studies
                        </button>
                      </Link>
                      <Link href="/chat" onClick={() => setIsOpen(false)}>
                        <button className="w-full flex items-center justify-start px-4 py-2 text-left bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Ask AI Assistant
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;