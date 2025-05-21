import { Helmet } from "react-helmet";
import HeroSection from "@/components/home/hero-section";
import AdvancedSearchSection from "@/components/home/advanced-search-section";
import BrowseOptionsSection from "@/components/home/browse-options-section";
import CategorySection from "@/components/home/category-section";
import LatestStudiesSection from "@/components/home/latest-studies-section";
import InfoSection from "@/components/home/info-section";
import NewsletterSection from "@/components/home/newsletter-section";
import JsonLd, { 
  generateOrganizationSchema, 
  generateFaqSchema 
} from "@/components/seo/JsonLd";

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Hydrogen Therapy Research Database | Science-Backed Health Benefits</title>
        <meta 
          name="description" 
          content="The most comprehensive resource for peer-reviewed studies on molecular hydrogen therapy. Discover scientifically-validated health benefits for inflammation, metabolism, neurological conditions, and more." 
        />
        <meta name="keywords" content="hydrogen therapy, molecular hydrogen, hydrogen water, h2 benefits, hydrogen gas, hydrogen research, hydrogen health studies, antioxidant therapy" />
        <link rel="canonical" href="https://hydrogenstudies.com" />
        
        {/* Open Graph Tags for better social sharing */}
        <meta property="og:title" content="Hydrogen Therapy Research Database | Evidence-Based Health Benefits" />
        <meta property="og:description" content="Explore the world's largest collection of scientific research on hydrogen therapy and its health applications. Trusted by researchers, practitioners, and health-conscious individuals." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com" />
        <meta property="og:image" content="https://hydrogenstudies.com/og-home-image.jpg" />
        <meta property="og:site_name" content="Hydrogen Studies" />
        
        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Hydrogen Therapy Research Database" />
        <meta name="twitter:description" content="Evidence-based research on molecular hydrogen's health benefits across various medical conditions and body systems." />
        <meta name="twitter:image" content="https://hydrogenstudies.com/og-home-image.jpg" />
      </Helmet>
      
      {/* WebSite Schema */}
      <JsonLd 
        type="WebSite"
        data={{
          name: "Hydrogen Studies Research Database",
          url: "https://hydrogenstudies.com",
          description: "Comprehensive research database for molecular hydrogen therapy and its health applications",
          potentialAction: {
            "@type": "SearchAction",
            "target": "https://hydrogenstudies.com/improved-search?query={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }}
      />
      
      {/* Organization Schema */}
      <JsonLd 
        type="Organization"
        data={generateOrganizationSchema({
          name: "Hydrogen Studies",
          url: "https://hydrogenstudies.com",
          logo: "https://hydrogenstudies.com/logo.png",
          description: "The authoritative source for molecular hydrogen health research, providing evidence-based information about the potential benefits of hydrogen therapy.",
          socialLinks: [
            "https://twitter.com/hydrogenstudies",
            "https://facebook.com/hydrogenstudies",
            "https://linkedin.com/company/hydrogenstudies"
          ]
        })}
      />
      
      {/* FAQ Schema for rich snippets */}
      <JsonLd 
        type="FAQPage"
        data={generateFaqSchema([
          {
            question: "What is molecular hydrogen therapy?",
            answer: "Molecular hydrogen (H2) therapy involves the therapeutic use of hydrogen gas or hydrogen-rich water for health benefits. Studies indicate it may act as a selective antioxidant, targeting harmful free radicals while preserving beneficial ones."
          },
          {
            question: "How can hydrogen be consumed for health benefits?",
            answer: "Hydrogen can be consumed through hydrogen-rich water, inhalation of hydrogen gas, hydrogen baths, or hydrogen saline injections. Each delivery method has different applications and efficacy depending on the condition being addressed."
          },
          {
            question: "What health conditions might benefit from hydrogen therapy?",
            answer: "Research suggests hydrogen therapy may benefit conditions involving oxidative stress and inflammation, including metabolic disorders, neurodegenerative diseases, cardiovascular conditions, skin disorders, and athletic recovery."
          },
          {
            question: "Is hydrogen therapy backed by scientific research?",
            answer: "Yes, there are over 1,500 peer-reviewed studies on hydrogen's biological effects. Research includes animal studies, cell culture experiments, and human clinical trials across various medical fields."
          },
          {
            question: "Where can I find research studies about hydrogen therapy?",
            answer: "HydrogenStudies.com maintains the world's largest database of peer-reviewed research on hydrogen therapy. You can search by health condition, body system, benefit, or research methodology."
          }
        ])}
      />

      <main>
        <HeroSection />
        <AdvancedSearchSection />
        <BrowseOptionsSection />
        <CategorySection />
        <LatestStudiesSection />
        <InfoSection />
        <NewsletterSection />
      </main>
    </>
  );
}