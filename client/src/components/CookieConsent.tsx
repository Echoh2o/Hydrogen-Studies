import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const COOKIE_CONSENT_KEY = "hs_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Show after a short delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-gray-900 border-t shadow-lg">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <Cookie className="h-6 w-6 text-teal-500 shrink-0 hidden sm:block" />
        <p className="text-sm text-muted-foreground flex-1 text-center sm:text-left">
          We use cookies to improve your experience and analyze site usage.
          By continuing, you agree to our{" "}
          <a href="/cookies" className="text-teal-600 underline">Cookie Policy</a> and{" "}
          <a href="/privacy" className="text-teal-600 underline">Privacy Policy</a>.
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={decline}>
            Decline
          </Button>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={accept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
