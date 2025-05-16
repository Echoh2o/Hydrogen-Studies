import HeroSection from "@/components/home/HeroSection";
import SearchSection from "@/components/home/SearchSection";
import CategoriesSection from "@/components/home/CategoriesSection";
import RecentStudiesSection from "@/components/home/RecentStudiesSection";
import ResearchOverviewSection from "@/components/home/ResearchOverviewSection";
import EducationalResourcesSection from "@/components/home/EducationalResourcesSection";
import NewsletterSection from "@/components/home/NewsletterSection";
import { Helmet } from "react-helmet";

const HomePage = () => {
  return (
    <>
      <Helmet>
        <title>Hydrogen Studies - Research Database for Hydrogen Gas and Health</title>
        <meta name="description" content="The comprehensive database for scientific studies on hydrogen gas and its health benefits. Discover research on hydrogen therapy for various medical conditions." />
      </Helmet>
      
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
