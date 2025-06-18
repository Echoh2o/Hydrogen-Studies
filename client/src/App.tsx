import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import Footer from "@/components/layout/Footer";
import CookieConsent from "@/components/ui/cookie-consent";
import { initGA } from "./lib/analytics";
import { useAnalytics } from "./hooks/use-analytics";

// Core Pages
import HomePage from "@/pages/HomePage";
import SearchPage from "@/pages/SearchPage";
import BenefitsPage from "@/pages/BenefitsPage";
import ProductsPage from "@/pages/ProductsPage";

import HydrogenBasicsPage from "@/pages/HydrogenBasicsPage";
import HealthBenefitsPage from "@/pages/HealthBenefitsPage";
import BlogListPage from "@/pages/BlogListPage";
import BlogArticlePage from "@/pages/BlogArticlePage";
import ContactUsPage from "@/pages/ContactUsPage";
import Studies from "@/pages/studies";
import EnhancedStudyPage from "@/pages/EnhancedStudyPage";
import EnhancedSearchPage from "@/pages/EnhancedSearchPage";
import StudyPage from "@/pages/StudyPage";
import StudyDetailsPage from "@/pages/StudyDetailsPage";
import SEOStudyPage from "@/pages/SEOStudyPage";
import About from "@/pages/about";
import NotFound from "@/pages/not-found";
import BlogPage from "@/pages/BlogPage";
import ChatPage from "@/pages/ChatPage";
import RecommendationsPage from "@/pages/RecommendationsPage";
import ResearchInsightsPage from "./pages/ResearchInsightsPage";
import ResearchAnalyticsPage from "./pages/ResearchAnalyticsPage";

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
import BlogsPage from "@/pages/admin/BlogsPage";
import AnalyticsPage from "@/pages/admin/AnalyticsPage";
import SettingsPage from "@/pages/admin/SettingsPage";
import UsersPage from "@/pages/admin/UsersPage";
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
import EnhancedAdminDashboard from "@/pages/admin/EnhancedAdminDashboard";

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return null;
}

function Router() {
  // Track page views when routes change
  useAnalytics();

  return (
    <Switch>
      {/* Core Public Routes */}
      <Route path="/" component={HomePage} />
      <Route path="/studies" component={Studies} />
      <Route path="/study/:id" component={StudyPage} />
      <Route path="/study/:slug" component={StudyDetailsPage} />
      <Route path="/studies/:slug" component={SEOStudyPage} />
      <Route path="/search" component={SearchPage} />
      <Route path="/advanced-search" component={EnhancedSearchPage} />
      <Route path="/benefits" component={BenefitsPage} />
      <Route path="/products" component={ProductsPage} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={ContactUsPage} />
      <Route path="/learn/basics" component={HydrogenBasicsPage} />
      <Route path="/learn/health-benefits" component={HealthBenefitsPage} />
      <Route path="/blog" component={BlogListPage} />
      <Route path="/blog/:id" component={BlogArticlePage} />
      <Route path="/categories/:category" component={ConditionCategoryPage} />
      <Route path="/categories/health-conditions" component={ExploreByCondition} />
      <Route path="/research-analytics" component={ResearchAnalyticsPage} />
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

      {/* Enhanced Admin Dashboard with WYSIWYG */}
      <Route path="/admin" component={EnhancedAdminDashboard} />
      <Route path="/admin/enhanced" component={EnhancedAdminDashboard} />
      <Route path="/admin/dashboard" component={DashboardPage} />
      <Route path="/admin/legacy" component={AdminPage} />
      <Route path="/admin/import" component={ImportPage} />

      {/* Admin Management Pages */}
      <Route path="/admin/studies" component={StudiesManagementPage} />
      <Route path="/admin/studies/add" component={AddStudyPage} />
      <Route path="/admin/studies/edit/:id" component={StudyEditPage} />
      <Route path="/admin/blogs" component={BlogsPage} />
      <Route path="/admin/blogs/generate" component={BlogGeneratePage} />
      <Route path="/admin/blog-generator" component={BlogGeneratePage} />
      <Route path="/admin/blogs/add" component={BlogAddPage} />
      <Route path="/admin/blogs/edit/:id" component={BlogEditPage} />

      {/* Admin Import & Data Pages */}
      <Route path="/admin/research-import" component={ResearchImportPage} />
      <Route path="/admin/data-import" component={DataImportPage} />
      <Route path="/admin/research-database" component={ResearchDatabasePage} />
      <Route path="/admin/journal-date-updater" component={JournalDateUpdater} />

      {/* Admin Enhancement Pages */}
      <Route path="/admin/content-enrichment" component={ContentEnrichmentPage} />
      <Route path="/admin/batch-enrichment" component={BatchEnrichmentPage} />
      <Route path="/admin/batch-categorization" component={BatchCategorizationPage} />
      <Route path="/admin/image-generation" component={ImageGenerationPage} />
      <Route path="/admin/enhancement" component={EnhancementPage} />
      <Route path="/admin/keyword-monitor" component={KeywordMonitorPage} />

      {/* Additional Admin Pages */}
      <Route path="/admin/analytics" component={AnalyticsPage} />
      <Route path="/admin/settings" component={SettingsPage} />
      <Route path="/admin/users" component={UsersPage} />

      {/* Admin Monitoring Pages */}
      <Route path="/admin/monitoring" component={AdminMonitoringPage} />
      <Route path="/admin/article-search" component={ArticleSearchPage} />
      <Route path="/admin/europe-pmc" component={EuropePmcPage} />
      <Route path="/admin/semantic-scholar" component={SemanticScholarPage} />
      <Route path="/admin/crossref" component={CrossRefPage} />

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

      {/* SEO-optimized study routes */}
      <Route path="/study/:slug" component={SEOStudyPage} />
      <Route path="/study/id/:id" component={SEOStudyPage} />

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
  const isHomePage = location === '/';

  // Initialize Google Analytics when app loads
  useEffect(() => {
    // Verify required environment variable is present
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
      console.warn('Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID');
    } else {
      initGA();
    }
  }, []);

  // Global error handling for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);

      // Prevent the default browser handling
      event.preventDefault();

      // Log the error details for debugging
      const errorDetails = {
        message: event.reason?.message || 'Unknown promise rejection',
        stack: event.reason?.stack || 'No stack trace available',
        timestamp: new Date().toISOString(),
        url: window.location.href
      };

      console.error('Promise rejection details:', errorDetails);

      // Show user-friendly error message if it's a network or API error
      if (event.reason?.message?.includes('fetch') || 
          event.reason?.message?.includes('network') ||
          event.reason?.message?.includes('API')) {
        console.warn('Network error occurred, but application continues running');
      }
    };

    const handleError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error);

      const errorDetails = {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        timestamp: new Date().toISOString()
      };

      console.error('Error details:', errorDetails);
    };

    // Add global error listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ScrollToTop />
        <div className="flex min-h-screen flex-col">
          {!isAdminRoute && (
            <CookieConsent />
          )}
          <main className={`flex-1 ${isAdminRoute ? 'p-0' : ''}`}>
            <Router />
          </main>
          {!isAdminRoute && !isHomePage && <Footer />}
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;