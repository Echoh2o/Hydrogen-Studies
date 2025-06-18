import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState, lazy, Suspense } from "react";
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

// Lazy load admin components for better performance
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));
const ImportPage = lazy(() => import('./pages/admin/ImportPage'));

// Tag-based navigation
const TaggedStudiesPage = lazy(() => import('./pages/TaggedStudiesPage'));
const AdminMonitoringPage = lazy(() => import('./pages/admin/AdminMonitoringPage'));
const ArticleSearchPage = lazy(() => import('./pages/admin/ArticleSearchPage'));
const EuropePmcPage = lazy(() => import('./pages/admin/EuropePmcPage'));
const SemanticScholarPage = lazy(() => import('./pages/admin/SemanticScholarPage'));
const CrossRefPage = lazy(() => import('./pages/admin/CrossRefPage'));

// Admin pages - new layout
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const StudiesManagementPage = lazy(() => import('./pages/admin/StudiesManagementPage'));
const AddStudyPage = lazy(() => import('./pages/admin/AddStudyPage'));
const StudyEditPage = lazy(() => import('./pages/admin/StudyEditPage'));
const BlogsPage = lazy(() => import('./pages/admin/BlogsPage'));
const AnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const BlogGeneratePage = lazy(() => import('./pages/admin/BlogGeneratePage'));
const BlogAddPage = lazy(() => import('./pages/admin/BlogAddPage'));
const BlogEditPage = lazy(() => import('./pages/admin/BlogEditPage'));
const ResearchImportPage = lazy(() => import('./pages/admin/ResearchImportPage'));
const DataImportPage = lazy(() => import('./pages/admin/DataImportPage'));
const ResearchDatabasePage = lazy(() => import('./pages/admin/ResearchDatabasePage'));
const JournalDateUpdater = lazy(() => import('./pages/admin/JournalDateUpdater'));
const ContentEnrichmentPage = lazy(() => import('./pages/admin/ContentEnrichmentPage'));
const BatchEnrichmentPage = lazy(() => import('./pages/admin/BatchEnrichmentPage'));
const BatchCategorizationPage = lazy(() => import('./pages/admin/BatchCategorizationPage'));
const ImageGenerationPage = lazy(() => import('./pages/admin/ImageGenerationPage'));
const EnhancementPage = lazy(() => import('./pages/admin/EnhancementPage'));
const KeywordMonitorPage = lazy(() => import('./pages/admin/KeywordMonitorPage'));
const EnhancedAdminDashboard = lazy(() => import('./pages/admin/EnhancedAdminDashboard'));

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
      <Route path="/admin" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <EnhancedAdminDashboard />
        </Suspense>
      } />
      <Route path="/admin/enhanced" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <EnhancedAdminDashboard />
        </Suspense>
      } />
      <Route path="/admin/dashboard" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <DashboardPage />
        </Suspense>
      } />
      <Route path="/admin/legacy" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <AdminPage />
        </Suspense>
      } />
      <Route path="/admin/import" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <ImportPage />
        </Suspense>
      } />

      {/* Admin Management Pages */}
      <Route path="/admin/studies" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <StudiesManagementPage />
        </Suspense>
      } />
      <Route path="/admin/studies/add" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <AddStudyPage />
        </Suspense>
      } />
      <Route path="/admin/studies/edit/:id" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <StudyEditPage />
        </Suspense>
      } />
      <Route path="/admin/blogs" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <BlogsPage />
        </Suspense>
      } />
      <Route path="/admin/blogs/generate" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <BlogGeneratePage />
        </Suspense>
      } />
      <Route path="/admin/blog-generator" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <BlogGeneratePage />
        </Suspense>
      } />
      <Route path="/admin/blogs/add" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <BlogAddPage />
        </Suspense>
      } />
      <Route path="/admin/blogs/edit/:id" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <BlogEditPage />
        </Suspense>
      } />

      {/* Admin Import & Data Pages */}
      <Route path="/admin/research-import" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <ResearchImportPage />
        </Suspense>
      } />
      <Route path="/admin/data-import" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <DataImportPage />
        </Suspense>
      } />
      <Route path="/admin/research-database" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <ResearchDatabasePage />
        </Suspense>
      } />
      <Route path="/admin/journal-date-updater" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <JournalDateUpdater />
        </Suspense>
      } />

      {/* Admin Enhancement Pages */}
      <Route path="/admin/content-enrichment" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <ContentEnrichmentPage />
        </Suspense>
      } />
      <Route path="/admin/batch-enrichment" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <BatchEnrichmentPage />
        </Suspense>
      } />
      <Route path="/admin/batch-categorization" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <BatchCategorizationPage />
        </Suspense>
      } />
      <Route path="/admin/image-generation" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <ImageGenerationPage />
        </Suspense>
      } />
      <Route path="/admin/enhancement" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <EnhancementPage />
        </Suspense>
      } />
      <Route path="/admin/keyword-monitor" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <KeywordMonitorPage />
        </Suspense>
      } />

      {/* Additional Admin Pages */}
      <Route path="/admin/analytics" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <AnalyticsPage />
        </Suspense>
      } />
      <Route path="/admin/settings" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <SettingsPage />
        </Suspense>
      } />
      <Route path="/admin/users" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <UsersPage />
        </Suspense>
      } />

      {/* Admin Monitoring Pages */}
      <Route path="/admin/monitoring" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <AdminMonitoringPage />
        </Suspense>
      } />
      <Route path="/admin/article-search" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <ArticleSearchPage />
        </Suspense>
      } />
      <Route path="/admin/europe-pmc" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <EuropePmcPage />
        </Suspense>
      } />
      <Route path="/admin/semantic-scholar" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <SemanticScholarPage />
        </Suspense>
      } />
      <Route path="/admin/crossref" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <CrossRefPage />
        </Suspense>
      } />

      {/* Tag-based Navigation */}
      <Route path="/studies/tags" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <TaggedStudiesPage />
        </Suspense>
      } />
      <Route path="/studies/tags/:category" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <TaggedStudiesPage />
        </Suspense>
      } />
      <Route path="/browse-by-tags" component={
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Admin...</div>}>
          <TaggedStudiesPage />
        </Suspense>
      } />

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