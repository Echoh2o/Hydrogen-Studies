import { Helmet } from "react-helmet";
import HeroSection from "@/components/home/hero-section";
import AdvancedSearchSection from "@/components/home/advanced-search-section";
import CategorySection from "@/components/home/category-section";
import LatestStudiesSection from "@/components/home/latest-studies-section";
import InfoSection from "@/components/home/info-section";
import NewsletterSection from "@/components/home/newsletter-section";

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Hydrogen Studies - Research Database for Hydrogen Gas and Health</title>
        <meta 
          name="description" 
          content="Access peer-reviewed studies on molecular hydrogen gas and its health applications in neurodegenerative diseases, metabolism, inflammation, and more." 
        />
        <meta property="og:title" content="Hydrogen Studies - Research Database" />
        <meta property="og:description" content="Comprehensive database of peer-reviewed hydrogen gas research for health applications." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com" />
      </Helmet>
      
      <HeroSection />
      <AdvancedSearchSection />
      <CategorySection />
      <LatestStudiesSection />
      <InfoSection />
      <NewsletterSection />
    </>
  );
}
