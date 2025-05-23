import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import CookieConsent from "@/components/ui/cookie-consent";

// Core Pages
import Home from "@/pages/home";
import Studies from "@/pages/studies";
import EnhancedStudyPage from "@/pages/EnhancedStudyPage";
import EnhancedSearchPage from "@/pages/EnhancedSearchPage";
import About from "@/pages/about";
import Contact from "@/pages/ContactPage";
import NotFound from "@/pages/not-found";
import BlogPage from "@/pages/BlogPage";
import ChatPage from "@/pages/ChatPage";
import RecommendationsPage from "@/pages/RecommendationsPage";

// Research Exploration Pages
import ExploreByCondition from "@/pages/ExploreByCondition";
import ConditionCategoryPage from "@/pages/ConditionCategoryPage";
import ExploreByBodySystem from "@/pages/ExploreByBodySystem";
import BodySystemCategoryPage from "@/pages/BodySystemCategoryPage";
import ExploreByLifeStage from "@/pages/ExploreByLifeStage";
import LifeStageCategoryPage from "@/pages/LifeStageCategoryPage";

// Admin Pages
import DashboardPage from "@/pages/admin/DashboardPage";
import StudiesManagementPage from "@/pages/admin/StudiesManagementPage";
import AddStudyPage from "@/pages/admin/AddStudyPage";
import StudyEditPage from "@/pages/admin/StudyEditPage";
import BlogsManagementPage from "@/pages/admin/BlogsManagementPage";
import BlogGeneratePage from "@/pages/admin/BlogGeneratePage";
import BlogAddPage from "@/pages/admin/BlogAddPage";
import BlogEditPage from "@/pages/admin/BlogEditPage";
import EnhancementPage from "@/pages/admin/EnhancementPage";
import DataImportPage from "@/pages/admin/DataImportPage";

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
      {/* Core Public Routes */}
      <Route path="/" component={Home} />
      <Route path="/studies" component={Studies} />
      <Route path="/study/:id" component={EnhancedStudyPage} />
      <Route path="/search" component={EnhancedSearchPage} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      
      {/* Research Exploration */}
      <Route path="/explore-by-condition" component={ExploreByCondition} />
      <Route path="/condition/:name" component={ConditionCategoryPage} />
      <Route path="/explore-by-body-system" component={ExploreByBodySystem} />
      <Route path="/body-system/:name" component={BodySystemCategoryPage} />
      <Route path="/explore-by-life-stage" component={ExploreByLifeStage} />
      <Route path="/life-stage/:name" component={LifeStageCategoryPage} />
      
      {/* Content & Resources */}
      <Route path="/blog/:id/:slug?" component={BlogPage} />
      <Route path="/recommendations" component={RecommendationsPage} />
      <Route path="/chat" component={ChatPage} />
      
      {/* Admin Dashboard */}
      <Route path="/admin" component={DashboardPage} />
      <Route path="/admin/studies" component={StudiesManagementPage} />
      <Route path="/admin/studies/add" component={AddStudyPage} />
      <Route path="/admin/studies/edit/:id" component={StudyEditPage} />
      <Route path="/admin/blogs" component={BlogsManagementPage} />
      <Route path="/admin/blogs/generate" component={BlogGeneratePage} />
      <Route path="/admin/blogs/add" component={BlogAddPage} />
      <Route path="/admin/blogs/edit/:id" component={BlogEditPage} />
      <Route path="/admin/enrichment" component={EnhancementPage} />
      <Route path="/admin/data-import" component={DataImportPage} />
      
      {/* Legacy route redirects */}
      <Route path="/categories" component={() => { window.location.replace('/explore-by-condition'); return null; }} />
      <Route path="/category/:id" component={() => { window.location.replace('/explore-by-condition'); return null; }} />
      <Route path="/resources" component={() => { window.location.replace('/recommendations'); return null; }} />
      <Route path="/learn" component={() => { window.location.replace('/about'); return null; }} />
      <Route path="/improved-search" component={() => { window.location.replace('/search'); return null; }} />
      <Route path="/studies/:id/:slug?" component={EnhancedStudyPage} />
      
      {/* 404 - Must be last */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  const isAdminRoute = location.startsWith('/admin');
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ScrollToTop />
        <div className="flex min-h-screen flex-col">
          {!isAdminRoute && (
            <>
              <CookieConsent />
              <Header />
            </>
          )}
          <main className={`flex-1 ${isAdminRoute ? 'p-0' : ''}`}>
            <Router />
          </main>
          {!isAdminRoute && <Footer />}
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;