import { Link } from "wouter";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-neutral-900 text-neutral-300 pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center mb-4">
              <span className="text-xl font-bold text-white">
                Hydrogen<span className="text-secondary">Studies</span>
              </span>
            </Link>
            <p className="text-sm mb-4">
              The comprehensive database for hydrogen gas research and its applications in health and medicine.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-neutral-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
                </svg>
              </a>
              <a href="#" className="text-neutral-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                  <rect x="2" y="9" width="4" height="12"></rect>
                  <circle cx="4" cy="4" r="2"></circle>
                </svg>
              </a>
              <a href="#" className="text-neutral-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                </svg>
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-white font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link href="/studies" className="hover:text-white transition-colors">Search Studies</Link></li>
              <li><Link href="/categories" className="hover:text-white transition-colors">Research Categories</Link></li>
              <li><Link href="/studies" className="hover:text-white transition-colors">Latest Publications</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-white font-bold mb-4">Categories</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/category/neurodegenerative" className="hover:text-white transition-colors">Neurodegenerative</Link></li>
              <li><Link href="/category/cardiovascular" className="hover:text-white transition-colors">Cardiovascular</Link></li>
              <li><Link href="/category/metabolism" className="hover:text-white transition-colors">Metabolism & Diabetes</Link></li>
              <li><Link href="/category/inflammation" className="hover:text-white transition-colors">Inflammation</Link></li>
              <li><Link href="/category/cancer" className="hover:text-white transition-colors">Cancer Research</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-white font-bold mb-4">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/resources#researchers" className="hover:text-white transition-colors">For Researchers</Link></li>
              <li><Link href="/resources#healthcare" className="hover:text-white transition-colors">For Healthcare Providers</Link></li>
              <li><Link href="/resources#bibliography" className="hover:text-white transition-colors">Bibliography Tools</Link></li>
              <li><Link href="/resources#methodology" className="hover:text-white transition-colors">Methodology</Link></li>
              <li><Link href="/resources#contact" className="hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-neutral-800 pt-6 text-sm text-neutral-500 flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            &copy; {currentYear} HydrogenStudies.com. All rights reserved.
          </div>
          <div className="flex space-x-4">
            <Link href="/privacy" className="hover:text-neutral-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-neutral-400 transition-colors">Terms of Service</Link>
            <Link href="/cookies" className="hover:text-neutral-400 transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
