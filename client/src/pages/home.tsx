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
            }
          })}
        </script>
        
        {/* Organization Schema */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Hydrogen Studies Research Database",
            "url": "https://hydrogenstudies.com",
            "logo": {
              "@type": "ImageObject",
              "url": "https://hydrogenstudies.com/logo.png"
            },
            "description": "The world's most comprehensive research database focused on molecular hydrogen therapy and its evidence-based health applications",
            "sameAs": [
              "https://twitter.com/hydrogenstudies",
              "https://www.facebook.com/hydrogenstudiesdb",
              "https://www.linkedin.com/company/hydrogen-studies"
            ],
            "contactPoint": {
              "@type": "ContactPoint",
              "telephone": "",
              "contactType": "customer service",
              "email": "contact@hydrogenstudies.com",
              "availableLanguage": "English"
            }
          })}
        </script>
        
        {/* FAQ Schema for Rich Results */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "What is molecular hydrogen therapy?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Molecular hydrogen (H2) therapy involves consuming hydrogen gas, typically by drinking hydrogen-rich water, inhaling hydrogen gas, or hydrogen bath therapy. Research suggests it may act as a selective antioxidant, potentially reducing oxidative stress and inflammation in the body without interfering with necessary cellular signaling."
                }
              },
              {
                "@type": "Question",
                "name": "What health conditions might benefit from hydrogen therapy?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Research studies have investigated hydrogen therapy's potential benefits for various conditions including metabolic disorders, inflammatory diseases, neurodegenerative conditions, cardiovascular health, and sports recovery. However, more clinical research is needed to fully establish efficacy for specific conditions."
                }
              },
              {
                "@type": "Question",
                "name": "How do I use the Hydrogen Studies Research Database?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Our database allows you to search for studies by keyword, filter by health condition, body system, or benefit category. You can browse studies chronologically, by relevance, or explore curated collections. Each study includes a comprehensive summary, methodology details, and links to original research when available."
                }
              },
              {
                "@type": "Question",
                "name": "Is hydrogen therapy scientifically proven?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Hydrogen therapy has shown promising results in numerous pre-clinical and some clinical studies. While research is still evolving, there is growing scientific evidence supporting its therapeutic potential for certain conditions. Our database compiles peer-reviewed studies to help researchers and consumers evaluate the current state of evidence."
                }
              },
              {
                "@type": "Question",
                "name": "What are the common methods of hydrogen administration?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "The most common methods include drinking hydrogen-rich water, inhaling hydrogen gas at specific concentrations, hydrogen baths, and hydrogen saline injections (primarily in clinical settings). Different administration methods may have varying efficacy depending on the target condition and individual factors."
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