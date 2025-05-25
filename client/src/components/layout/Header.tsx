import React from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X, Search, MessageCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export default function Header() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);

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
            {/* Studies Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                    location.startsWith('/studies') || location.startsWith('/explore') || location === '/insights'
                      ? 'text-blue-600 border-b-2 border-blue-600 pb-1' 
                      : 'text-gray-700'
                  }`}
                >
                  Studies
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                {studiesDropdownItems.map((item) => (
                  <DropdownMenuItem key={item.name} asChild>
                    <Link href={item.href} className="cursor-pointer">
                      {item.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

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
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col space-y-4 mt-8">
                  {/* Studies Section in Mobile */}
                  <div className="space-y-2">
                    <div className="text-lg font-medium text-gray-900 border-b pb-2">Studies</div>
                    {studiesDropdownItems.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className="block text-base text-gray-600 hover:text-blue-600 pl-4 py-1"
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                  
                  {/* Regular Navigation */}
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`text-lg font-medium transition-colors hover:text-blue-600 ${
                        isActive(item.href) ? 'text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      {item.name}
                    </Link>
                  ))}
                  <div className="border-t pt-4 space-y-2">
                    <Link href="/search" onClick={() => setIsOpen(false)}>
                      <Button variant="outline" className="w-full justify-start">
                        <Search className="h-4 w-4 mr-2" />
                        Search Studies
                      </Button>
                    </Link>
                    <Link href="/chat" onClick={() => setIsOpen(false)}>
                      <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Ask AI Assistant
                      </Button>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}