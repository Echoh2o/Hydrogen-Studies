import React from 'react';
import { Link } from 'wouter';
import { Mail, Twitter, Linkedin, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Footer() {
  const [email, setEmail] = React.useState('');

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Newsletter signup logic would go here
    console.log('Newsletter signup:', email);
    setEmail('');
  };

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">H₂</span>
              </div>
              <span className="font-bold text-xl">HydrogenStudies</span>
            </div>
            <p className="text-gray-300 text-sm">
              The world's most comprehensive database of peer-reviewed hydrogen health research. 
              Making scientific knowledge accessible to everyone.
            </p>
            <div className="flex space-x-4">
              <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white p-2">
                <Twitter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white p-2">
                <Linkedin className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white p-2">
                <Github className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Explore</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/search" className="text-gray-300 hover:text-white transition-colors">
                  Browse Studies
                </Link>
              </li>
              <li>
                <Link href="/search" className="text-gray-300 hover:text-white transition-colors">
                  Advanced Search
                </Link>
              </li>
              <li>
                <Link href="/insights" className="text-gray-300 hover:text-white transition-colors">
                  Research Insights
                </Link>
              </li>
              <li>
                <Link href="/chat" className="text-gray-300 hover:text-white transition-colors">
                  AI Assistant
                </Link>
              </li>
            </ul>
          </div>

          {/* Learn */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Learn</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/learn" className="text-gray-300 hover:text-white transition-colors">
                  Hydrogen Basics
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-gray-300 hover:text-white transition-colors">
                  Research Blog
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-gray-300 hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-300 hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Stay Updated</h3>
            <p className="text-gray-300 text-sm">
              Get the latest hydrogen research updates delivered to your inbox.
            </p>
            <form onSubmit={handleNewsletterSubmit} className="space-y-2">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                required
              />
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Subscribe
              </Button>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="text-sm text-gray-400">
            © 2024 HydrogenStudies. All rights reserved. 
            <span className="ml-2">
              Powered by <Link href="https://echowater.com" className="text-blue-400 hover:text-blue-300">EchoWater</Link>
            </span>
          </div>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link href="/privacy" className="text-sm text-gray-400 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-gray-400 hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link href="/sitemap" className="text-sm text-gray-400 hover:text-white transition-colors">
              Sitemap
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}