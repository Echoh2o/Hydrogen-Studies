import HeroSection from "@/components/home/HeroSection";
import SearchSection from "@/components/home/SearchSection";
import CategoriesSection from "@/components/home/CategoriesSection";
import RecentStudiesSection from "@/components/home/RecentStudiesSection";
import ResearchOverviewSection from "@/components/home/ResearchOverviewSection";
import EducationalResourcesSection from "@/components/home/EducationalResourcesSection";
import NewsletterSection from "@/components/home/NewsletterSection";
import SEOHead from "@/components/seo/SEOHead";
import StructuredData from "@/components/seo/StructuredData";

const HomePage = () => {
  const keywords = [
    'hydrogen therapy',
    'molecular hydrogen',
    'hydrogen gas health benefits',
    'hydrogen research',
    'antioxidant therapy',
    'scientific studies',
    'medical research database',
    'hydrogen medicine',
    'therapeutic hydrogen',
    'hydrogen health studies'
  ];

  return (
    <>
      <SEOHead
        title="Hydrogen Research Database - Comprehensive Studies on Hydrogen Therapy & Health Benefits"
        description="Explore 1,300+ authentic scientific studies on hydrogen gas therapy and health benefits. Advanced search, categorization by health conditions, and evidence-based research on molecular hydrogen."
        canonicalUrl={window.location.origin}
        ogImage={`${window.location.origin}/og-homepage.jpg`}
        ogType="website"
        keywords={keywords}
      />
      
      <StructuredData type="organization" />
      <StructuredData type="website" />
      <StructuredData 
        type="breadcrumb" 
        breadcrumbs={[
          { name: "Home", url: window.location.origin }
        ]}
      />
      
      <HeroSection />
      <SearchSection />
      <CategoriesSection />
      <RecentStudiesSection />
      <ResearchOverviewSection />
      <EducationalResourcesSection />
      <NewsletterSection />
    </>
  );
};

export default HomePage;
