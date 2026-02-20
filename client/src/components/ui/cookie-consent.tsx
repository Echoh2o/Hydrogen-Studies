import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookiesAccepted");
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookiesAccepted", "accepted");
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookiesAccepted", "declined");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-gray-900 border-t shadow-lg">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1 text-center sm:text-left">
          We use cookies to improve your experience and analyze site usage.
          By continuing, you agree to our{" "}
          <a href="/cookies" className="text-teal-600 underline hover:text-teal-500">Cookie Policy</a> and{" "}
          <a href="/privacy" className="text-teal-600 underline hover:text-teal-500">Privacy Policy</a>.
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleDecline}>
            Decline
          </Button>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleAccept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
