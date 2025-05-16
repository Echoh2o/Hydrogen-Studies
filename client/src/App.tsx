import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import CookieConsent from "@/components/ui/cookie-consent";

// Pages
import Home from "@/pages/home";
import Studies from "@/pages/studies";
import StudyDetails from "@/pages/study-details";
import Categories from "@/pages/categories";
import CategoryDetails from "@/pages/category-details";
import About from "@/pages/about";
import Resources from "@/pages/resources";
import ContactPage from "@/pages/ContactPage";
import NotFound from "@/pages/not-found";

function ScrollToTop() {
  const [location] = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/studies" component={Studies} />
      <Route path="/study/:id" component={StudyDetails} />
      <Route path="/categories" component={Categories} />
      <Route path="/category/:id" component={CategoryDetails} />
      <Route path="/about" component={About} />
      <Route path="/resources" component={Resources} />
      <Route path="/contact" component={ContactPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ScrollToTop />
        <div className="flex min-h-screen flex-col">
          <CookieConsent />
          <Header />
          <main className="flex-1">
            <Router />
          </main>
          <Footer />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
