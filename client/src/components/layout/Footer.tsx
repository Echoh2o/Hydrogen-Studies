import React from "react";
import { Link } from "wouter";
import {
  Mail,
  Twitter,
  Linkedin,
  Github,
  Droplets,
  Shield,
  HelpCircle,
  Building2,
  ShoppingCart,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildEchoUrl, echoProductUrl, ECHO_PRODUCTS } from "@shared/echo-products";
import { trackOutboundClick } from "@/lib/analytics";

// Echo Water store links, tagged for attribution (utm_content=footer).
const echoStoreLinks = [
  { label: "Shop Hydrogen Water", href: buildEchoUrl("/", { content: "footer" }) },
  { label: "Echo Flask", href: echoProductUrl(ECHO_PRODUCTS.flask, { content: "footer" }) },
  { label: "Echo Ultimate", href: echoProductUrl(ECHO_PRODUCTS.ultimate, { content: "footer" }) },
  { label: "Echo Refresh (Inhalation)", href: echoProductUrl(ECHO_PRODUCTS.refresh, { content: "footer" }) },
];

const echoHomeUrl = buildEchoUrl("/", { content: "footer-bottom" });

export default function Footer() {
  const [email, setEmail] = React.useState("");
  const [subscribeStatus, setSubscribeStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const currentYear = new Date().getFullYear();

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || subscribeStatus === "loading") return;

    setSubscribeStatus("loading");
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      if (data.success) {
        setSubscribeStatus("success");
        setEmail("");
      } else {
        setSubscribeStatus("error");
      }
    } catch {
      setSubscribeStatus("error");
    }
  };

  return (
    <footer className="bg-gray-900 text-white border-t-4 border-teal-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-8">
          {/* Company Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center">
              <Droplets className="h-7 w-7 text-teal-500 mr-2.5 flex-shrink-0" />
              <div className="flex flex-col leading-none">
                <span className="text-lg font-bold tracking-wider uppercase" style={{ fontFamily: "'Montserrat', sans-serif", letterSpacing: '0.12em' }}>
                  Hydrogen Studies
                </span>
                <span className="text-[10px] font-medium tracking-widest text-teal-400 uppercase mt-0.5" style={{ fontFamily: "'Montserrat', sans-serif", letterSpacing: '0.18em' }}>
                  powered by echo water
                </span>
              </div>
            </div>
            <p className="text-gray-300 text-sm">
              The world's most comprehensive database of peer-reviewed hydrogen
              health research. Making scientific knowledge accessible to
              everyone.
            </p>
            <div className="flex space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-300 hover:text-white hover:bg-gray-800 p-2"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-300 hover:text-white hover:bg-gray-800 p-2"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-300 hover:text-white hover:bg-gray-800 p-2"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-300 hover:text-white hover:bg-gray-800 p-2"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Legal Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-teal-500" />
              Legal
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="text-gray-300 hover:text-teal-400 transition-colors inline-block"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-gray-300 hover:text-teal-400 transition-colors inline-block"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/cookies"
                  className="text-gray-300 hover:text-teal-400 transition-colors inline-block"
                >
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/disclaimer"
                  className="text-gray-300 hover:text-teal-400 transition-colors inline-block"
                >
                  Medical Disclaimer
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-teal-500" />
              Support
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/contact"
                  className="text-gray-300 hover:text-teal-400 transition-colors inline-block"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-gray-300 hover:text-teal-400 transition-colors inline-block"
                >
                  Research Blog
                </Link>
              </li>
              <li>
                <Link
                  href="/learn/basics"
                  className="text-gray-300 hover:text-teal-400 transition-colors inline-block"
                >
                  Learn About H₂
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-teal-500" />
              Company
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/about"
                  className="text-gray-300 hover:text-teal-400 transition-colors inline-block"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  href="/studies"
                  className="text-gray-300 hover:text-teal-400 transition-colors inline-block"
                >
                  Browse Studies
                </Link>
              </li>
              <li>
                <Link
                  href="/research-analytics"
                  className="text-gray-300 hover:text-teal-400 transition-colors inline-block"
                >
                  Research Analytics
                </Link>
              </li>
              <li>
                <Link
                  href="/products"
                  className="text-gray-300 hover:text-teal-400 transition-colors inline-block"
                >
                  Products
                </Link>
              </li>
            </ul>
          </div>

          {/* Echo Water Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-teal-500" />
              Echo Water
            </h3>
            <ul className="space-y-2 text-sm">
              {echoStoreLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener"
                    onClick={() => trackOutboundClick(link.href, "footer")}
                    className="text-gray-300 hover:text-teal-400 transition-colors inline-block"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Newsletter Section */}
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="max-w-md mx-auto text-center space-y-4">
            <h3 className="font-semibold text-lg">Stay Updated</h3>
            <p className="text-gray-300 text-sm">
              Get the latest hydrogen research updates delivered to your inbox.
            </p>
            {subscribeStatus === "success" ? (
              <div className="flex items-center justify-center gap-2 text-teal-400 py-2">
                <CheckCircle2 className="h-5 w-5" />
                <span>You're subscribed! Check your inbox for a welcome email.</span>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setSubscribeStatus("idle"); }}
                  className="bg-gray-800 border-gray-700 text-white placeholder-gray-400 flex-1"
                  required
                />
                <Button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6"
                  disabled={subscribeStatus === "loading"}
                >
                  {subscribeStatus === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Subscribe"
                  )}
                </Button>
              </form>
            )}
            {subscribeStatus === "error" && (
              <p className="text-red-400 text-sm">Something went wrong. Please try again.</p>
            )}
          </div>
        </div>

        {/* Medical Disclaimer */}
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex items-start gap-3 rounded-lg bg-gray-800/50 p-4 text-xs text-gray-400 leading-relaxed">
            <Shield className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              <span className="font-semibold text-gray-300">Medical Disclaimer:</span>{" "}
              The information on this website is for educational and informational purposes only and is
              not intended as medical advice, diagnosis, or treatment. The research presented represents
              published scientific studies; individual results may vary. Always consult a qualified
              healthcare provider before making health decisions. Hydrogen Studies is not affiliated with
              any medical institution.{" "}
              <Link href="/disclaimer" className="text-teal-400 hover:text-teal-300 underline transition-colors">
                Read our full medical disclaimer
              </Link>.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-400 text-center md:text-left">
              © {currentYear} Hydrogen Studies. Powered by{" "}
              <a href={echoHomeUrl} target="_blank" rel="noopener" onClick={() => trackOutboundClick(echoHomeUrl, "footer-bottom")} className="text-teal-400 hover:text-teal-300 transition-colors">Echo Water</a>.
              All rights reserved.
            </div>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              <Link
                href="/sitemap.xml"
                className="text-gray-400 hover:text-teal-400 transition-colors"
              >
                Sitemap
              </Link>
              <Link
                href="/privacy"
                className="text-gray-400 hover:text-teal-400 transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-gray-400 hover:text-teal-400 transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/contact"
                className="text-gray-400 hover:text-teal-400 transition-colors"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
