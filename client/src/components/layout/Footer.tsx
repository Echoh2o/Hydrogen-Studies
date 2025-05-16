import { Link } from "wouter";
import { FaTwitter, FaLinkedin, FaFacebook, FaArrowRight } from "react-icons/fa";

const Footer = () => {
  return (
    <footer className="bg-neutral-800 text-white pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-1">
            <Link href="/" className="inline-block mb-4">
              <img 
                src="./src/assets/hydrogen-studies-logo.svg" 
                alt="Hydrogen Studies Research Database" 
                className="h-12 mb-2"
              />
              <div className="flex flex-col">
                <span className="text-xl font-bold text-white">HydrogenStudies</span>
                <span className="text-xs text-neutral-400">Part of the EchoWater Ecosystem</span>
              </div>
            </Link>
            <p className="text-neutral-400 mb-4">The comprehensive database for hydrogen water research and its scientifically-verified health benefits.</p>
            <div className="flex items-center space-x-4 mb-4">
              <a href="https://www.echowater.com" target="_blank" rel="noopener" className="text-white hover:text-primary-light transition flex items-center bg-neutral-700 py-1 px-3 rounded">
                <span className="mr-2">Visit EchoWater.com</span>
                <FaArrowRight size={12} />
              </a>
            </div>
            <div className="flex space-x-4">
              <a href="#" className="text-neutral-400 hover:text-white transition">
                <FaTwitter size={18} />
              </a>
              <a href="#" className="text-neutral-400 hover:text-white transition">
                <FaLinkedin size={18} />
              </a>
              <a href="#" className="text-neutral-400 hover:text-white transition">
                <FaFacebook size={18} />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/">
                  <a className="text-neutral-400 hover:text-white transition">Home</a>
                </Link>
              </li>
              <li>
                <Link href="/about">
                  <a className="text-neutral-400 hover:text-white transition">About</a>
                </Link>
              </li>
              <li>
                <Link href="/categories">
                  <a className="text-neutral-400 hover:text-white transition">Categories</a>
                </Link>
              </li>
              <li>
                <Link href="/recent">
                  <a className="text-neutral-400 hover:text-white transition">Recent Studies</a>
                </Link>
              </li>
              <li>
                <Link href="/contact">
                  <a className="text-neutral-400 hover:text-white transition">Contact</a>
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Categories</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/category/neurology">
                  <a className="text-neutral-400 hover:text-white transition">Neurology</a>
                </Link>
              </li>
              <li>
                <Link href="/category/cardiology">
                  <a className="text-neutral-400 hover:text-white transition">Cardiology</a>
                </Link>
              </li>
              <li>
                <Link href="/category/immunology">
                  <a className="text-neutral-400 hover:text-white transition">Immunology</a>
                </Link>
              </li>
              <li>
                <Link href="/category/metabolism">
                  <a className="text-neutral-400 hover:text-white transition">Metabolism</a>
                </Link>
              </li>
              <li>
                <Link href="/category/clinical-trials">
                  <a className="text-neutral-400 hover:text-white transition">Clinical Trials</a>
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Resources</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/resources/beginners-guide">
                  <a className="text-neutral-400 hover:text-white transition">Beginner's Guide</a>
                </Link>
              </li>
              <li>
                <Link href="/resources/research-methods">
                  <a className="text-neutral-400 hover:text-white transition">Research Methods</a>
                </Link>
              </li>
              <li>
                <Link href="/resources/clinical-applications">
                  <a className="text-neutral-400 hover:text-white transition">Clinical Applications</a>
                </Link>
              </li>
              <li>
                <Link href="/faq">
                  <a className="text-neutral-400 hover:text-white transition">FAQ</a>
                </Link>
              </li>
              <li>
                <Link href="/glossary">
                  <a className="text-neutral-400 hover:text-white transition">Glossary</a>
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-neutral-700 pt-6 mt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-neutral-500 text-sm mb-4 md:mb-0">&copy; {new Date().getFullYear()} HydrogenStudies.com. All rights reserved.</p>
            <div className="flex space-x-6">
              <Link href="/privacy">
                <a className="text-neutral-500 hover:text-white text-sm transition">Privacy Policy</a>
              </Link>
              <Link href="/terms">
                <a className="text-neutral-500 hover:text-white text-sm transition">Terms of Service</a>
              </Link>
              <Link href="/sitemap">
                <a className="text-neutral-500 hover:text-white text-sm transition">Sitemap</a>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
