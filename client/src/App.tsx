import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CookieConsent from "@/components/ui/cookie-consent";

// Core Pages
import Home from "@/pages/home";
import NewHomePage from "@/pages/NewHomePage";
import LearnPage from "@/pages/LearnPage";
import HydrogenBasicsPage from "@/pages/HydrogenBasicsPage";
import HealthBenefitsPage from "@/pages/HealthBenefitsPage";
import BlogListPage from "@/pages/BlogListPage";
import BlogArticlePage from "@/pages/BlogArticlePage";
import AboutUsPage from "@/pages/AboutUsPage";
import ContactUsPage from "@/pages/ContactUsPage";
import Studies from "@/pages/studies";
import EnhancedStudyPage from "@/pages/EnhancedStudyPage";
import EnhancedSearchPage from "@/pages/EnhancedSearchPage";
import About from "@/pages/about";
import Contact from "@/pages/ContactPage";
import NotFound from "@/pages/not-found";
import BlogPage from "@/pages/BlogPage";
import ChatPage from "@/pages/ChatPage";
import RecommendationsPage from "@/pages/RecommendationsPage";
import ResearchInsightsPage from "@/pages/ResearchInsightsPage";

// Educational content pages
import HydrogenTherapyGuide from "@/pages/educational/HydrogenTherapyGuide";

// New organization structure pages
import ExploreByBenefit from "@/pages/ExploreByBenefit";
import ExploreByCondition from "@/pages/ExploreByCondition";
import ConditionCategoryPage from "@/pages/ConditionCategoryPage";
import ExploreByBodySystem from "@/pages/ExploreByBodySystem";
import BodySystemCategoryPage from "@/pages/BodySystemCategoryPage";
import ExploreByLifeStage from "@/pages/ExploreByLifeStage";
import LifeStageCategoryPage from "@/pages/LifeStageCategoryPage";
import ExploreByDemographicPage, { DemographicDetailPage } from "@/pages/ExploreByDemographic";
import ExploreByMechanismPage, { MechanismDetailPage } from "@/pages/ExploreByMechanism";
import ExploreByDeliveryMethodPage, { DeliveryMethodDetailPage } from "@/pages/ExploreByDeliveryMethod";

// Admin pages - updated
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminPage from "@/pages/admin/AdminPage";
import ImportPage from "@/pages/admin/ImportPage";

// Tag-based navigation
import TaggedStudiesPage from "@/pages/TaggedStudiesPage";
import AdminMonitoringPage from "@/pages/admin/AdminMonitoringPage";
import ArticleSearchPage from "@/pages/admin/ArticleSearchPage";
import EuropePmcPage from "@/pages/admin/EuropePmcPage";
import SemanticScholarPage from "@/pages/admin/SemanticScholarPage";
import CrossRefPage from "@/pages/admin/CrossRefPage";

// Admin pages - new layout
import DashboardPage from "@/pages/admin/DashboardPage";
import StudiesManagementPage from "@/pages/admin/StudiesManagementPage";
import AddStudyPage from "@/pages/admin/AddStudyPage";
import StudyEditPage from "@/pages/admin/StudyEditPage";
import BlogsManagementPage from "@/pages/admin/BlogsManagementPage";
import BlogGeneratePage from "@/pages/admin/BlogGeneratePage";
import BlogAddPage from "@/pages/admin/BlogAddPage";
import BlogEditPage from "@/pages/admin/BlogEditPage";
import ResearchImportPage from "@/pages/admin/ResearchImportPage";
import DataImportPage from "@/pages/admin/DataImportPage";
import ResearchDatabasePage from "@/pages/admin/ResearchDatabasePage";
import JournalDateUpdater from "@/pages/admin/JournalDateUpdater";
import ContentEnrichmentPage from "@/pages/admin/ContentEnrichmentPage";
import BatchEnrichmentPage from "@/pages/admin/BatchEnrichmentPage";
import BatchCategorizationPage from "@/pages/admin/BatchCategorizationPage";
import ImageGenerationPage from "@/pages/admin/ImageGenerationPage";
import EnhancementPage from "@/pages/admin/EnhancementPage";
import KeywordMonitorPage from "@/pages/admin/KeywordMonitorPage";

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
      <Route path="/" component={NewHomePage} />
      <Route path="/old-home" component={Home} />
      <Route path="/studies" component={Studies} />
      <Route path="/study/:id" component={EnhancedStudyPage} />
      <Route path="/search" component={EnhancedSearchPage} />
      <Route path="/advanced-search" component={EnhancedSearchPage} />
      <Route path="/about" component={AboutUsPage} />
      <Route path="/contact" component={ContactUsPage} />
      <Route path="/learn" component={LearnPage} />
      <Route path="/learn/basics" component={HydrogenBasicsPage} />
      <Route path="/learn/health-benefits" component={HealthBenefitsPage} />
      <Route path="/blog" component={BlogListPage} />
      <Route path="/blog/:id" component={BlogArticlePage} />
      <Route path="/categories/:category" component={ConditionCategoryPage} />
      <Route path="/categories/health-conditions" component={ExploreByCondition} />
      <Route path="/insights" component={ResearchInsightsPage} />
      <Route path="/research-insights" component={ResearchInsightsPage} />
      
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
      
      {/* Admin Dashboard - Updated */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/legacy" component={AdminPage} />
      <Route path="/admin/import" component={ImportPage} />
      
      {/* Tag-based Navigation */}
      <Route path="/studies/tags" component={TaggedStudiesPage} />
      <Route path="/studies/tags/:category" component={TaggedStudiesPage} />
      <Route path="/browse-by-tags" component={TaggedStudiesPage} />
      
      {/* Legacy route redirects */}
      <Route path="/categories" component={() => { window.location.replace('/explore-by-condition'); return null; }} />
      <Route path="/category/:id" component={() => { window.location.replace('/explore-by-condition'); return null; }} />
      <Route path="/resources" component={() => { window.location.replace('/recommendations'); return null; }} />
      <Route path="/learn" component={() => { window.location.replace('/about'); return null; }} />
      <Route path="/improved-search" component={() => { window.location.replace('/search'); return null; }} />
      
      {/* Legacy studies route - redirect to study */}
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
