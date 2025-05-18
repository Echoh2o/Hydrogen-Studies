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
import Learn from "@/pages/learn";
import Contact from "@/pages/ContactPage";
import NotFound from "@/pages/not-found";
import BlogPage from "@/pages/BlogPage";
import ChatPage from "@/pages/ChatPage";

// New organization structure pages
import ExploreByBenefitPage, { BenefitDetailPage } from "@/pages/ExploreByBenefit";
import ExploreByDemographicPage, { DemographicDetailPage } from "@/pages/ExploreByDemographic";
import ExploreByMechanismPage, { MechanismDetailPage } from "@/pages/ExploreByMechanism";
import ExploreByDeliveryMethodPage, { DeliveryMethodDetailPage } from "@/pages/ExploreByDeliveryMethod";

// Admin pages - old
import AdminPage from "@/pages/admin/AdminPage";
import ImportPage from "@/pages/admin/ImportPage";
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
      {/* Public Routes */}
      <Route path="/" component={Home} />
      <Route path="/studies" component={Studies} />
      <Route path="/study/:id" component={StudyDetails} />
      <Route path="/blog/:id/:slug?" component={BlogPage} />
      <Route path="/categories" component={Categories} />
      <Route path="/category/:id" component={CategoryDetails} />
      <Route path="/about" component={About} />
      <Route path="/resources" component={Resources} />
      <Route path="/learn" component={Learn} />
      <Route path="/contact" component={Contact} />
      <Route path="/chat" component={ChatPage} />
      
      {/* New Organization Structure Routes */}
      <Route path="/benefits" component={ExploreByBenefitPage} />
      <Route path="/benefits/:slug" component={BenefitDetailPage} />
      <Route path="/demographics" component={ExploreByDemographicPage} />
      <Route path="/demographics/:slug" component={DemographicDetailPage} />
      <Route path="/mechanisms" component={ExploreByMechanismPage} />
      <Route path="/mechanisms/:slug" component={MechanismDetailPage} />
      <Route path="/delivery-methods" component={ExploreByDeliveryMethodPage} />
      <Route path="/delivery-methods/:slug" component={DeliveryMethodDetailPage} />
      
      {/* Admin Routes - new layout */}
      <Route path="/admin" component={DashboardPage} />
      <Route path="/admin/studies" component={StudiesManagementPage} />
      <Route path="/admin/studies/add" component={AddStudyPage} />
      <Route path="/admin/studies/edit/:id" component={StudyEditPage} />
      <Route path="/admin/blogs" component={BlogsManagementPage} />
      <Route path="/admin/blogs/generate" component={BlogGeneratePage} />
      <Route path="/admin/blogs/add" component={BlogAddPage} />
      <Route path="/admin/blogs/edit/:id" component={BlogEditPage} />
      <Route path="/admin/research-import" component={ResearchImportPage} />
      <Route path="/admin/data-import" component={DataImportPage} />
      <Route path="/admin/research-database" component={ResearchDatabasePage} />
      <Route path="/admin/journal-dates" component={JournalDateUpdater} />
      
      {/* Legacy Admin Routes - will be removed after transition */}
      <Route path="/admin/legacy" component={AdminPage} />
      <Route path="/admin/import" component={ImportPage} />
      <Route path="/admin/articles" component={ArticleSearchPage} />
      <Route path="/admin/europepmc" component={EuropePmcPage} />
      <Route path="/admin/semanticscholar" component={SemanticScholarPage} />
      <Route path="/admin/crossref" component={CrossRefPage} />
      
      {/* 404 */}
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
