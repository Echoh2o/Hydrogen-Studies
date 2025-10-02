import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const CookieBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const cookieConsent = localStorage.getItem("cookie-consent");
    if (cookieConsent !== "accepted") {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white shadow-md p-4 z-50 border-t border-neutral-200">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between">
        <p className="mb-4 md:mb-0 md:mr-6">
          This website uses cookies to ensure you get the best experience on our
          website.
        </p>
        <div className="flex space-x-3">
          <Link href="/privacy#cookies">
            <Button
              variant="outline"
              className="border-primary text-primary hover:text-primary-dark"
            >
              MORE INFO
            </Button>
          </Link>
          <Button
            onClick={handleAccept}
            className="bg-primary text-white hover:bg-primary-dark"
          >
            YES, I ACCEPT
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
