import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if the user has already accepted cookies
    const cookiesAccepted = localStorage.getItem("cookiesAccepted") === "true";
    if (!cookiesAccepted) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookiesAccepted", "true");
    setIsVisible(false);
  };

  const handleMoreInfo = () => {
    // Navigate to cookie policy or open modal with more information
    // For now, just log to console
    console.log("More info clicked");
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white shadow-lg z-50 p-4 flex flex-col sm:flex-row justify-between items-center border-t border-neutral-200">
      <p className="text-neutral-800 text-sm md:text-base mb-3 sm:mb-0">
        This website uses cookies to ensure you get the best experience on our website.
      </p>
      <div className="flex space-x-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMoreInfo}
          className="text-neutral-600 hover:text-primary"
        >
          MORE INFO
        </Button>
        <Button
          size="sm"
          onClick={handleAccept}
          className="bg-primary text-white hover:bg-primary/90"
        >
          YES, I ACCEPT
        </Button>
      </div>
    </div>
  );
}
