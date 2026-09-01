import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState, lazy, Suspense, startTransition } from "react";
import CookieConsent from "@/components/ui/cookie-consent";
import { initGA, initAhrefs } from "./lib/analytics";
import { initErrorTracking, trackError } from "./lib/error-tracking";
import { useAnalytics } from "./hooks/use-analytics";
import PageLoader from "@/components/ui/page-loader";
import {
  EnhancedErrorBoundary,
  PageErrorBoundary,
  AsyncErrorBoundary,
} from "@/components/ui/enhanced-error-boundary";

// Critical page - keep as direct import for fastest initial load
import HomePage from "@/pages/HomePage";

// Authentication components - critical for security
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

// Password reset pages
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));

// Lazy load all non-critical pages for better performance
const SearchPage = lazy(() => import("@/pages/SearchPage"));
const BenefitsPage = lazy(() => import("@/pages/BenefitsPage"));
const LearnPage = lazy(() => import("@/pages/LearnPage"));
const ProductsPage = lazy(() => import("@/pages/ProductsPage"));
const HydrogenBasicsPage = lazy(() => import("@/pages/HydrogenBasicsPage"));
const HealthBenefitsPage = lazy(() => import("@/pages/HealthBenefitsPage"));
const PublicBlogListPage = lazy(() => import("@/pages/BlogListPage"));
const BlogCategoryPage = lazy(() => import("@/pages/BlogCategoryPage"));
const ContactUsPage = lazy(() => import("@/pages/ContactUsPage"));

// Legal and Policy Pages
const PrivacyPolicyPage = lazy(() => import("@/pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("@/pages/TermsOfServicePage"));
const CookiePolicyPage = lazy(() => import("@/pages/CookiePolicyPage"));
const MedicalDisclaimerPage = lazy(() => import("@/pages/MedicalDisclaimerPage"));
const EditorialPolicyPage = lazy(() => import("@/pages/EditorialPolicyPage"));
const MethodologyPage = lazy(() => import("@/pages/MethodologyPage"));
const ContactPage = lazy(() => import("@/pages/ContactPage"));
const Studies = lazy(() => import("@/pages/studies"));
const EnhancedSearchPage = lazy(() => import("@/pages/EnhancedSearchPage"));
const StudyPage = lazy(() => import("@/pages/StudyPage"));
const SEOStudyPage = lazy(() => import("@/pages/SEOStudyPage"));
const About = lazy(() => import("@/pages/about"));
const NotFound = lazy(() => import("@/pages/not-found"));
const BlogPage = lazy(() => import("@/pages/BlogPage"));
// ChatPage removed — AI assistant disabled per user request
const RecommendationsPage = lazy(() => import("@/pages/RecommendationsPage"));
// /insights redirects to /research-analytics (consolidated)
const ResearchAnalyticsPage = lazy(
  () => import("./pages/ResearchAnalyticsPage"),
);
const StudyExplorerPage = lazy(() => import("./pages/StudyExplorerPage"));

// Educational content pages
const HydrogenTherapyGuide = lazy(
  () => import("@/pages/educational/HydrogenTherapyGuide"),
);

// New organization structure pages
const ExploreByBenefit = lazy(() => import("@/pages/ExploreByBenefit"));
const ExploreByCondition = lazy(() => import("@/pages/ExploreByCondition"));
const ConditionCategoryPage = lazy(
  () => import("@/pages/ConditionCategoryPage"),
);
const HydrogenForConditionPage = lazy(() => import("@/pages/HydrogenForConditionPage"));
const ExploreByBodySystem = lazy(() => import("@/pages/ExploreByBodySystem"));
const BodySystemCategoryPage = lazy(
  () => import("@/pages/BodySystemCategoryPage"),
);
const ExploreByLifeStage = lazy(() => import("@/pages/ExploreByLifeStage"));
const LifeStageCategoryPage = lazy(
  () => import("@/pages/LifeStageCategoryPage"),
);
const ExploreByDemographicPage = lazy(() =>
  import("@/pages/ExploreByDemographic").then((module) => ({
    default: module.default,
  })),
);
const DemographicDetailPage = lazy(() =>
  import("@/pages/ExploreByDemographic").then((module) => ({
    default: module.DemographicDetailPage,
  })),
);
const ExploreByMechanismPage = lazy(() =>
  import("@/pages/ExploreByMechanism").then((module) => ({
    default: module.default,
  })),
);
const MechanismDetailPage = lazy(() =>
  import("@/pages/ExploreByMechanism").then((module) => ({
    default: module.MechanismDetailPage,
  })),
);
const ExploreByDeliveryMethodPage = lazy(() =>
  import("@/pages/ExploreByDeliveryMethod").then((module) => ({
    default: module.default,
  })),
);
const DeliveryMethodDetailPage = lazy(() =>
  import("@/pages/ExploreByDeliveryMethod").then((module) => ({
    default: module.DeliveryMethodDetailPage,
  })),
);

// Authentication pages
const UserManagementPage = lazy(
  () => import("./pages/admin/UserManagementPage"),
);

// Tag-based navigation
const TaggedStudiesPage = lazy(() => import("./pages/TaggedStudiesPage"));
const AdminMonitoringPage = lazy(
  () => import("./pages/admin/AdminMonitoringPage"),
);

// Admin pages
const StudiesManagementPage = lazy(
  () => import("./pages/admin/StudiesManagementPage"),
);
const AddStudyPage = lazy(() => import("./pages/admin/AddStudyPage"));
const StudyEditPage = lazy(() => import("./pages/admin/StudyEditPage"));
const AnalyticsPage = lazy(() => import("./pages/admin/AnalyticsPage"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const BlogGeneratePage = lazy(() => import("./pages/admin/BlogGeneratePage"));
const BlogAddPage = lazy(() => import("./pages/admin/BlogAddPage"));
const BlogEditPage = lazy(() => import("./pages/admin/BlogEditPage"));
const BlogListPage = lazy(() => import("./pages/admin/BlogListPage"));
const BlogCategoriesPage = lazy(
  () => import("./pages/admin/BlogCategoriesPage"),
);
const BlogRecommendationPage = lazy(
  () => import("./pages/admin/BlogRecommendationPage"),
);
const ResearchImportPage = lazy(
  () => import("./pages/admin/ResearchImportPage"),
);
const DataImportPage = lazy(() => import("./pages/admin/DataImportPage"));
const DeletionLedgerPage = lazy(() => import("./pages/admin/DeletionLedgerPage"));
const ContentEnrichmentPage = lazy(
  () => import("./pages/admin/ContentEnrichmentPage"),
);
const BatchEnrichmentPage = lazy(
  () => import("./pages/admin/BatchEnrichmentPage"),
);
const BatchCategorizationPage = lazy(
  () => import("./pages/admin/BatchCategorizationPage"),
);
const ImageGenerationPage = lazy(
  () => import("./pages/admin/ImageGenerationPage"),
);
const KeywordMonitorPage = lazy(
  () => import("./pages/admin/KeywordMonitorPage"),
);
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const TrendsAnalysisPage = lazy(
  () => import("./pages/admin/TrendsAnalysisPage"),
);
const ReviewAssistantPage = lazy(
  () => import("./pages/admin/ReviewAssistantPage"),
);
const MultiFormatGeneratorPage = lazy(
  () => import("./pages/admin/MultiFormatGeneratorPage"),
);
const SEOContentStrategyPage = lazy(
  () => import("./pages/admin/SEOContentStrategyPage"),
);
const NaturalLanguageSearchPage = lazy(
  () => import("./pages/NaturalLanguageSearchPage"),
);
const RecentStudiesPage = lazy(() => import("./pages/RecentStudiesPage"));
const MyDashboardPage = lazy(() => import("./pages/MyDashboardPage"));
const PipelineDashboardPage = lazy(() => import("./pages/admin/PipelineDashboardPage"));
const LinkManagementPage = lazy(() => import("./pages/admin/LinkManagementPage"));
const RedirectsPage = lazy(() => import("./pages/admin/RedirectsPage"));
const SearchConsolePage = lazy(() => import("./pages/admin/SearchConsolePage"));
const AnalyticsGa4Page = lazy(() => import("./pages/admin/AnalyticsGa4Page"));
const PillarsPage = lazy(() => import("./pages/admin/PillarsPage"));
const ShopifySyncPage = lazy(() => import("./pages/admin/ShopifySyncPage"));
const JobsPage = lazy(() => import("./pages/admin/JobsPage"));
const ThisWeekPage = lazy(() => import("./pages/ThisWeekPage"));

// Content Hub / Pillar Pages
const ContentHubIndexPage = lazy(() => import("./pages/ContentHubIndexPage"));
const ContentHubPage = lazy(() => import("./pages/ContentHubPage"));

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
    <PageErrorBoundary>
      <Switch>
        {/* Authentication Routes */}
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />

        {/* Core Public Routes */}
        <Route path="/" component={HomePage} />
        <Route path="/studies" component={Studies} />
        <Route path="/study/id/:id" component={StudyPage} />
        <Route path="/study/:slug" component={SEOStudyPage} />
        {/* Tag routes must precede /studies/:slug so the :slug param does not shadow them */}
        <Route path="/studies/tags" component={TaggedStudiesPage} />
        <Route path="/studies/tags/:category" component={TaggedStudiesPage} />
        <Route path="/studies/:slug" component={SEOStudyPage} />
        <Route path="/search" component={SearchPage} />
        <Route
          path="/search/natural-language"
          component={NaturalLanguageSearchPage}
        />
        <Route path="/advanced-search" component={EnhancedSearchPage} />
        <Route path="/benefits">{() => <Redirect to="/learn" />}</Route>
        <Route path="/learn" component={LearnPage} />
        <Route path="/products" component={ProductsPage} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={ContactPage} />
        
        {/* Legal and Policy Pages */}
        <Route path="/privacy" component={PrivacyPolicyPage} />
        <Route path="/terms" component={TermsOfServicePage} />
        <Route path="/cookies" component={CookiePolicyPage} />
        <Route path="/disclaimer" component={MedicalDisclaimerPage} />
        <Route path="/editorial-policy" component={EditorialPolicyPage} />
        <Route path="/methodology" component={MethodologyPage} />
        <Route path="/learn/basics" component={HydrogenBasicsPage} />
        <Route path="/learn/health-benefits" component={HealthBenefitsPage} />
        <Route path="/blog" component={PublicBlogListPage} />
        <Route path="/blog/category/:slug" component={BlogCategoryPage} />
        {/* Consolidated Blog Page - handles both /blog/id and /blog/slug via param detection */}
        <Route path="/blog/:id" component={BlogPage} />
        <Route path="/blog/:id/:slug" component={BlogPage} />
        <Route path="/recommendations" component={RecommendationsPage} />
        {/* /chat route removed — AI assistant disabled */}

        {/* User Dashboard - Authenticated */}
        <Route path="/my-dashboard" component={MyDashboardPage} />

        {/* Admin Dashboard - Protected */}
        <Route path="/admin">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <AdminDashboard />
            </ProtectedRoute>
          )}
        </Route>
        {/* Legacy admin route redirects */}
        <Route path="/admin/enhanced">{() => <Redirect to="/admin" />}</Route>
        <Route path="/admin/dashboard">{() => <Redirect to="/admin" />}</Route>
        <Route path="/admin/legacy">{() => <Redirect to="/admin" />}</Route>
        <Route path="/admin/import">{() => <Redirect to="/admin/data-import" />}</Route>

        {/* Admin Management Pages - Protected */}
        <Route path="/admin/users">
          {() => (
            <ProtectedRoute requiredRoles={["admin"]}>
              <UserManagementPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/studies">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <StudiesManagementPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/studies/add">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <AddStudyPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/studies/edit/:id">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <StudyEditPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/blogs">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <BlogListPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/blogs/generate">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <BlogGeneratePage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/blog-generator">{() => <Redirect to="/admin/blogs/generate" />}</Route>
        <Route path="/admin/blogs/add">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <BlogAddPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/blogs/edit/:id">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <BlogEditPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/blog-categories">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <BlogCategoriesPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/blog-recommendations">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <BlogRecommendationPage />
            </ProtectedRoute>
          )}
        </Route>

        {/* Admin Import & Data Pages - Protected */}
        <Route path="/admin/research-import">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <ResearchImportPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/data-import">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <DataImportPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/deletion-ledger">
          {() => (
            <ProtectedRoute requiredRoles={["admin"]}>
              <DeletionLedgerPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/research-database">{() => <Redirect to="/admin/studies" />}</Route>
        <Route path="/admin/journal-date-updater">{() => <Redirect to="/admin/pipeline" />}</Route>

        {/* Admin Enhancement Pages - Protected */}
        <Route path="/admin/content-enrichment">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <ContentEnrichmentPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/batch-enrichment">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <BatchEnrichmentPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/batch-categorization">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <BatchCategorizationPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/image-generation">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <ImageGenerationPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/enhancement">{() => <Redirect to="/admin/batch-enrichment" />}</Route>
        <Route path="/admin/keyword-monitor">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <KeywordMonitorPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/trends">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <TrendsAnalysisPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/review-assistant">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <ReviewAssistantPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/multi-format">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <MultiFormatGeneratorPage />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/admin/seo-strategy">
          {() => (
            <ProtectedRoute requiredRoles={["admin"]}>
              <SEOContentStrategyPage />
            </ProtectedRoute>
          )}
        </Route>

        {/* Additional Admin Pages - Protected */}
        <Route path="/admin/analytics">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <AnalyticsPage />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/settings">
          {() => (
            <ProtectedRoute requiredRoles={["admin"]}>
              <SettingsPage />
            </ProtectedRoute>
          )}
        </Route>

        {/* Admin Monitoring Pages - Protected */}
        <Route path="/admin/monitoring">
          {() => (
            <ProtectedRoute requiredRoles={["admin", "editor"]}>
              <AdminMonitoringPage />
            </ProtectedRoute>
          )}
        </Route>
        {/* Research Pipeline Dashboard - Protected */}
        <Route path="/admin/pipeline">
          {() => (
            <ProtectedRoute requiredRoles={["admin"]}>
              <PipelineDashboardPage />
            </ProtectedRoute>
          )}
        </Route>
        {/* Admin Link Management - Protected */}
        <Route path="/admin/links">
          {() => (
            <ProtectedRoute requiredRoles={["admin"]}>
              <LinkManagementPage />
            </ProtectedRoute>
          )}
        </Route>
        {/* Admin Redirect Management - Protected */}
        <Route path="/admin/redirects">
          {() => (
            <ProtectedRoute requiredRoles={["admin"]}>
              <RedirectsPage />
            </ProtectedRoute>
          )}
        </Route>
        {/* Admin Google Search Console — Phase A integration */}
        <Route path="/admin/seo/search-console">
          {() => (
            <ProtectedRoute requiredRoles={["admin"]}>
              <SearchConsolePage />
            </ProtectedRoute>
          )}
        </Route>
        {/* Admin GA4 Analytics — Phase D integration */}
        <Route path="/admin/seo/analytics">
          {() => (
            <ProtectedRoute requiredRoles={["admin"]}>
              <AnalyticsGa4Page />
            </ProtectedRoute>
          )}
        </Route>
        {/* Admin Pillars — Phase B dashboard */}
        <Route path="/admin/seo/pillars">
          {() => (
            <ProtectedRoute requiredRoles={["admin"]}>
              <PillarsPage />
            </ProtectedRoute>
          )}
        </Route>
        {/* Admin Shopify customer sync */}
        <Route path="/admin/shopify-sync">
          {() => (
            <ProtectedRoute requiredRoles={["admin"]}>
              <ShopifySyncPage />
            </ProtectedRoute>
          )}
        </Route>
        {/* Admin Blog generation jobs (paused/stuck job recovery) */}
        <Route path="/admin/jobs">
          {() => (
            <ProtectedRoute requiredRoles={["admin"]}>
              <JobsPage />
            </ProtectedRoute>
          )}
        </Route>
        {/* Research source pages consolidated into /admin/research-import */}
        <Route path="/admin/article-search">{() => <Redirect to="/admin/research-import" />}</Route>
        <Route path="/admin/europe-pmc">{() => <Redirect to="/admin/research-import" />}</Route>
        <Route path="/admin/semantic-scholar">{() => <Redirect to="/admin/research-import" />}</Route>
        <Route path="/admin/crossref">{() => <Redirect to="/admin/research-import" />}</Route>

        {/* Explore Pages - Browse by category */}
        <Route path="/explore-by-benefit" component={ExploreByBenefit} />
        <Route path="/explore-by-condition" component={ExploreByCondition} />
        <Route path="/explore-by-condition/:category" component={ConditionCategoryPage} />
        <Route path="/hydrogen-for/:condition" component={HydrogenForConditionPage} />
        <Route path="/explore-by-body-system" component={ExploreByBodySystem} />
        <Route path="/explore-by-body-system/:category" component={BodySystemCategoryPage} />
        <Route path="/explore-by-life-stage" component={ExploreByLifeStage} />
        <Route path="/explore-by-life-stage/:category" component={LifeStageCategoryPage} />
        <Route path="/explore-by-demographic" component={ExploreByDemographicPage} />
        <Route path="/explore-by-demographic/:demographic" component={DemographicDetailPage} />
        <Route path="/explore-by-mechanism" component={ExploreByMechanismPage} />
        <Route path="/explore-by-mechanism/:mechanism" component={MechanismDetailPage} />
        <Route path="/explore-by-delivery-method" component={ExploreByDeliveryMethodPage} />
        <Route path="/explore-by-delivery-method/:method" component={DeliveryMethodDetailPage} />

        {/* Additional Public Pages */}
        <Route path="/insights">{() => { window.location.replace("/research-analytics"); return null; }}</Route>
        <Route path="/research-analytics" component={ResearchAnalyticsPage} />
        <Route path="/recent-studies" component={RecentStudiesPage} />
        <Route path="/study-explorer" component={StudyExplorerPage} />
        <Route path="/learn/therapy-guide" component={HydrogenTherapyGuide} />
        <Route path="/contact-us" component={ContactUsPage} />
        <Route path="/this-week" component={ThisWeekPage} />

        {/* Content Hubs / Pillar Pages */}
        <Route path="/hub" component={ContentHubIndexPage} />
        <Route path="/hub/:topic" component={ContentHubPage} />

        {/* Tag-based Navigation (/studies/tags routes are declared above /studies/:slug) */}
        <Route path="/browse-by-tags" component={TaggedStudiesPage} />

        {/* Legacy route redirects */}
        <Route path="/categories">{() => <Redirect to="/explore-by-condition" />}</Route>
        <Route path="/category/:id">{() => <Redirect to="/explore-by-condition" />}</Route>
        <Route path="/resources">{() => <Redirect to="/recommendations" />}</Route>
        {/* /learn is now a real page — old redirect removed */}
        <Route path="/improved-search">{() => <Redirect to="/search" />}</Route>

        {/* 404 - Must be last */}
        <Route component={NotFound} />
      </Switch>
    </PageErrorBoundary>
  );
}

function App() {
  const [location] = useLocation();
  const isAdminRoute = location.startsWith("/admin");
  const isHomePage = location === "/";

  // Initialize error tracking and analytics
  useEffect(() => {
    initErrorTracking();
    startTransition(() => {
      initGA();
      initAhrefs();
    });

    // Global error handling
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);

      // Show user-friendly error message if it's a network or API error
      if (
        event.reason?.message?.includes("fetch") ||
        event.reason?.message?.includes("network") ||
        event.reason?.message?.includes("API")
      ) {
        console.warn(
          "Network error occurred, but application continues running",
        );
      }
    };

    const handleError = (event: ErrorEvent) => {
      console.error("Global error caught:", event.error);

      const errorDetails = {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        timestamp: new Date().toISOString(),
      };

      console.error("Error details:", errorDetails);
    };

    // Add global error listeners
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
      window.removeEventListener("error", handleError);
    };
  }, []);

  return (
    <EnhancedErrorBoundary
      onError={(error, errorInfo) => {
        console.error("App-level error:", error);
        trackError(error instanceof Error ? error : new Error(String(error)), "App");
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ScrollToTop />
          {/* Skip to main content link for keyboard/screen reader users */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-teal-600 focus:text-white focus:px-4 focus:py-2 focus:rounded"
          >
            Skip to main content
          </a>
          <div className="flex min-h-screen flex-col">
            {!isAdminRoute && <CookieConsent />}
            <main id="main-content" className={`flex-1 ${isAdminRoute ? "p-0" : ""}`}>
              <AsyncErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Router />
                </Suspense>
              </AsyncErrorBoundary>
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </EnhancedErrorBoundary>
  );
}

export default App;
