import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState, lazy, Suspense, startTransition } from "react";
import Footer from "@/components/layout/Footer";
import CookieConsent from "@/components/ui/cookie-consent";
import { initGA } from "./lib/analytics";
import { useAnalytics } from "./hooks/use-analytics";
import PageLoader from "@/components/ui/page-loader";
import { EnhancedErrorBoundary, PageErrorBoundary, AsyncErrorBoundary } from "@/components/ui/enhanced-error-boundary";

// Critical page - keep as direct import for fastest initial load
import HomePage from "@/pages/HomePage";

// Authentication components - critical for security
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

// Lazy load all non-critical pages for better performance
const SearchPage = lazy(() => import("@/pages/SearchPage"));
const BenefitsPage = lazy(() => import("@/pages/BenefitsPage"));
const ProductsPage = lazy(() => import("@/pages/ProductsPage"));
const HydrogenBasicsPage = lazy(() => import("@/pages/HydrogenBasicsPage"));
const HealthBenefitsPage = lazy(() => import("@/pages/HealthBenefitsPage"));
const PublicBlogListPage = lazy(() => import("@/pages/BlogListPage"));
const BlogArticlePage = lazy(() => import("@/pages/BlogArticlePage"));
const ContactUsPage = lazy(() => import("@/pages/ContactUsPage"));
const Studies = lazy(() => import("@/pages/studies"));
const EnhancedStudyPage = lazy(() => import("@/pages/EnhancedStudyPage"));
const EnhancedSearchPage = lazy(() => import("@/pages/EnhancedSearchPage"));
const StudyPage = lazy(() => import("@/pages/StudyPage"));
const StudyDetailsPage = lazy(() => import("@/pages/StudyDetailsPage"));
const SEOStudyPage = lazy(() => import("@/pages/SEOStudyPage"));
const About = lazy(() => import("@/pages/about"));
const NotFound = lazy(() => import("@/pages/not-found"));
const BlogPage = lazy(() => import("@/pages/BlogPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const RecommendationsPage = lazy(() => import("@/pages/RecommendationsPage"));
const ResearchInsightsPage = lazy(() => import("./pages/ResearchInsightsPage"));
const ResearchAnalyticsPage = lazy(() => import("./pages/ResearchAnalyticsPage"));
const StudyExplorerPage = lazy(() => import("./pages/StudyExplorerPage"));

// Educational content pages
const HydrogenTherapyGuide = lazy(() => import("@/pages/educational/HydrogenTherapyGuide"));

// New organization structure pages
const ExploreByBenefit = lazy(() => import("@/pages/ExploreByBenefit"));
const ExploreByCondition = lazy(() => import("@/pages/ExploreByCondition"));
const ConditionCategoryPage = lazy(() => import("@/pages/ConditionCategoryPage"));
const ExploreByBodySystem = lazy(() => import("@/pages/ExploreByBodySystem"));
const BodySystemCategoryPage = lazy(() => import("@/pages/BodySystemCategoryPage"));
const ExploreByLifeStage = lazy(() => import("@/pages/ExploreByLifeStage"));
const LifeStageCategoryPage = lazy(() => import("@/pages/LifeStageCategoryPage"));
const ExploreByDemographicPage = lazy(() => import("@/pages/ExploreByDemographic").then(module => ({ default: module.default })));
const DemographicDetailPage = lazy(() => import("@/pages/ExploreByDemographic").then(module => ({ default: module.DemographicDetailPage })));
const ExploreByMechanismPage = lazy(() => import("@/pages/ExploreByMechanism").then(module => ({ default: module.default })));
const MechanismDetailPage = lazy(() => import("@/pages/ExploreByMechanism").then(module => ({ default: module.MechanismDetailPage })));
const ExploreByDeliveryMethodPage = lazy(() => import("@/pages/ExploreByDeliveryMethod").then(module => ({ default: module.default })));
const DeliveryMethodDetailPage = lazy(() => import("@/pages/ExploreByDeliveryMethod").then(module => ({ default: module.DeliveryMethodDetailPage })));

// Authentication pages
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage'));

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
const BlogListPage = lazy(() => import('./pages/admin/BlogListPage'));
const BlogCategoriesPage = lazy(() => import('./pages/admin/BlogCategoriesPage'));
const BlogRecommendationPage = lazy(() => import('./pages/admin/BlogRecommendationPage'));
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
const TrendsAnalysisPage = lazy(() => import('./pages/admin/TrendsAnalysisPage'));
const ReviewAssistantPage = lazy(() => import('./pages/admin/ReviewAssistantPage'));
const ContentOptimizationPage = lazy(() => import('./pages/admin/ContentOptimizationPage'));
const MultiFormatGeneratorPage = lazy(() => import('./pages/admin/MultiFormatGeneratorPage'));
const NaturalLanguageSearchPage = lazy(() => import('./pages/NaturalLanguageSearchPage'));

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
      
      {/* Core Public Routes */}
      <Route path="/" component={HomePage} />
      <Route path="/studies" component={Studies} />
      <Route path="/study/:id" component={StudyPage} />
      <Route path="/study/:slug" component={StudyDetailsPage} />
      <Route path="/studies/:slug" component={SEOStudyPage} />
      <Route path="/search" component={SearchPage} />
      <Route path="/search/natural-language" component={NaturalLanguageSearchPage} />
      <Route path="/advanced-search" component={EnhancedSearchPage} />
      <Route path="/benefits" component={BenefitsPage} />
      <Route path="/products" component={ProductsPage} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={ContactUsPage} />
      <Route path="/learn/basics" component={HydrogenBasicsPage} />
      <Route path="/learn/health-benefits" component={HealthBenefitsPage} />
      <Route path="/blog" component={PublicBlogListPage} />
      <Route path="/blog/:id" component={BlogArticlePage} />
      <Route path="/categories/:category" component={ConditionCategoryPage} />
      <Route path="/categories/health-conditions" component={ExploreByCondition} />
      <Route path="/research-analytics" component={ResearchAnalyticsPage} />
      <Route path="/insights" component={ResearchInsightsPage} />
      <Route path="/research-insights" component={ResearchInsightsPage} />
      <Route path="/study-explorer" component={StudyExplorerPage} />

      {/* Research Exploration */}
      <Route path="/explore-by-condition" component={ExploreByCondition} />
      <Route path="/condition/:name" component={ConditionCategoryPage} />
      <Route path="/explore-by-body-system" component={ExploreByBodySystem} />
      <Route path="/body-system/:name" component={BodySystemCategoryPage} />
      <Route path="/explore-by-life-stage" component={ExploreByLifeStage} />
      <Route path="/life-stage/:name" component={LifeStageCategoryPage} />
      <Route path="/explore-by-benefit" component={ExploreByBenefit} />
      <Route path="/explore-by-delivery-method" component={ExploreByDeliveryMethodPage} />
      <Route path="/delivery-methods/:slug" component={DeliveryMethodDetailPage} />

      {/* Recent Studies Redirect */}
      <Route path="/recent-studies">
        {() => {
          window.location.href = '/studies';
          return null;
        }}
      </Route>

      {/* Content & Resources */}
      <Route path="/blog/:id/:slug?" component={BlogPage} />
      <Route path="/recommendations" component={RecommendationsPage} />
      <Route path="/chat" component={ChatPage} />

      {/* Enhanced Admin Dashboard with WYSIWYG - Protected */}
      <Route path="/admin">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <EnhancedAdminDashboard />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/enhanced">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <EnhancedAdminDashboard />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/dashboard">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <DashboardPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/legacy">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <AdminPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/import">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <ImportPage />
          </ProtectedRoute>
        )}
      </Route>

      {/* Admin Management Pages - Protected */}
      <Route path="/admin/users">
        {() => (
          <ProtectedRoute requiredRoles={['admin']}>
            <UserManagementPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/studies">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <StudiesManagementPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/studies/add">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <AddStudyPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/studies/edit/:id">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <StudyEditPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/blogs">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <BlogListPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/blogs/generate">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <BlogGeneratePage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/blog-generator">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <BlogGeneratePage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/blogs/add">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <BlogAddPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/blogs/edit/:id">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <BlogEditPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/blog-categories">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <BlogCategoriesPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/blog-recommendations">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <BlogRecommendationPage />
          </ProtectedRoute>
        )}
      </Route>

      {/* Admin Import & Data Pages - Protected */}
      <Route path="/admin/research-import">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <ResearchImportPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/data-import">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <DataImportPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/research-database">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <ResearchDatabasePage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/journal-date-updater">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <JournalDateUpdater />
          </ProtectedRoute>
        )}
      </Route>

      {/* Admin Enhancement Pages - Protected */}
      <Route path="/admin/content-enrichment">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <ContentEnrichmentPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/batch-enrichment">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <BatchEnrichmentPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/batch-categorization">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <BatchCategorizationPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/image-generation">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <ImageGenerationPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/enhancement">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <EnhancementPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/keyword-monitor">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <KeywordMonitorPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/trends">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <TrendsAnalysisPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/review-assistant">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <ReviewAssistantPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/content-optimization">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <ContentOptimizationPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/multi-format">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <MultiFormatGeneratorPage />
          </ProtectedRoute>
        )}
      </Route>

      {/* Additional Admin Pages - Protected */}
      <Route path="/admin/analytics">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <AnalyticsPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/settings">
        {() => (
          <ProtectedRoute requiredRoles={['admin']}>
            <SettingsPage />
          </ProtectedRoute>
        )}
      </Route>

      {/* Admin Monitoring Pages - Protected */}
      <Route path="/admin/monitoring">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <AdminMonitoringPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/article-search">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <ArticleSearchPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/europe-pmc">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <EuropePmcPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/semantic-scholar">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <SemanticScholarPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/crossref">
        {() => (
          <ProtectedRoute requiredRoles={['admin', 'editor']}>
            <CrossRefPage />
          </ProtectedRoute>
        )}
      </Route>

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
    </PageErrorBoundary>
  );
}

function App() {
  const [location] = useLocation();
  const isAdminRoute = location.startsWith('/admin');
  const isHomePage = location === '/';

  // Initialize Google Analytics when app loads
  useEffect(() => {
    startTransition(() => {
      // Verify required environment variable is present
      if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
        console.warn('Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID');
      } else {
        initGA();
      }
    });

    // Global error handling
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);

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
    <EnhancedErrorBoundary
      onError={(error, errorInfo) => {
        console.error('App-level error:', error);
        // Could send to error tracking service here
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ScrollToTop />
          <div className="flex min-h-screen flex-col">
            {!isAdminRoute && (
              <CookieConsent />
            )}
            <main className={`flex-1 ${isAdminRoute ? 'p-0' : ''}`}>
              <AsyncErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Router />
                </Suspense>
              </AsyncErrorBoundary>
            </main>
            {!isAdminRoute && !isHomePage && <Footer />}
          </div>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </EnhancedErrorBoundary>
  );
}

export default App;