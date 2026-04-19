import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Home, ArrowLeft } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <>
      <Helmet>
        <title>Page Not Found - Hydrogen Studies</title>
        <meta name="description" content="The page you're looking for doesn't exist on Hydrogen Studies. Search our hydrogen research database or return to the homepage." />
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <SiteHeader />
      <main className="min-h-[70vh] w-full flex items-center justify-center bg-gray-50 px-4 py-16">
        <Card className="w-full max-w-lg text-center">
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className="text-6xl font-bold text-teal-600" aria-hidden="true">
              404
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Page Not Found
              </h1>
              <p className="text-gray-600">
                Sorry, the page you're looking for doesn't exist or has been moved.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Go Back
              </Button>
              <Button
                onClick={() => setLocation("/")}
                className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Home Page
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/search")}
                className="gap-2"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                Search Studies
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </>
  );
}
