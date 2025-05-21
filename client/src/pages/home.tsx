import { Helmet } from "react-helmet";
import HeroSection from "@/components/home/hero-section";
import AdvancedSearchSection from "@/components/home/advanced-search-section";
import BrowseOptionsSection from "@/components/home/browse-options-section";
import CategorySection from "@/components/home/category-section";
import LatestStudiesSection from "@/components/home/latest-studies-section";
import InfoSection from "@/components/home/info-section";
import NewsletterSection from "@/components/home/newsletter-section";

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
        <meta property="og:image" content="/og-home-image.jpg" />
        <meta property="og:site_name" content="Hydrogen Studies" />
        
        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Hydrogen Therapy Research Database" />
        <meta name="twitter:description" content="Evidence-based research on molecular hydrogen's health benefits across various medical conditions and body systems." />
        <meta name="twitter:image" content="/og-home-image.jpg" />
        
        {/* Schema.org structured data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "url": "https://hydrogenstudies.com",
            "name": "Hydrogen Studies Research Database",
            "description": "Comprehensive research database for molecular hydrogen therapy and its health applications",
            "potentialAction": {
              "@type": "SearchAction",
              "target": "https://hydrogenstudies.com/improved-search?query={search_term_string}",
              "query-input": "required name=search_term_string"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Hydrogen Studies",
              "logo": {
                "@type": "ImageObject",
                "url": "https://hydrogenstudies.com/logo.png"
              }
            }
          })}
        </script>
        
        {/* FAQ Schema for homepage - key hydrogen therapy questions */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "What is hydrogen therapy?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Hydrogen therapy refers to therapeutic applications of molecular hydrogen (H2) administered through hydrogen-rich water, hydrogen gas inhalation, or hydrogen baths. Molecular hydrogen acts as a selective antioxidant that can penetrate cell membranes and neutralize harmful free radicals while preserving beneficial reactive oxygen species."
                }
              },
              {
                "@type": "Question",
                "name": "What health conditions can hydrogen therapy help with?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Research suggests hydrogen therapy may benefit various conditions including metabolic disorders, inflammatory conditions, neurodegenerative diseases, cardiovascular issues, and sports recovery. The scientific database contains studies investigating effects on specific conditions like Parkinson's disease, diabetes, arthritis, and athletic performance."
                }
              },
              {
                "@type": "Question",
                "name": "How is hydrogen therapy administered?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Hydrogen can be administered through multiple methods: drinking hydrogen-rich water, inhaling hydrogen gas, taking hydrogen baths, or using hydrogen-generating supplements. Each delivery method has different bioavailability characteristics and potential applications depending on the health condition being addressed."
                }
              }
            ]
          })}
        </script>
      </Helmet>
      
      <HeroSection />
      <AdvancedSearchSection />
      <BrowseOptionsSection />
      <LatestStudiesSection />
      <CategorySection />
      <InfoSection />
      <NewsletterSection />
    </>
  );
}
