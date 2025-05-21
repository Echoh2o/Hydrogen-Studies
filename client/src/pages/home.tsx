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
              },
              {
                "@type": "Question",
                "name": "Is hydrogen therapy backed by scientific research?",
                "acceptedAnswer": {
                  "@type": "Answer", 
                  "text": "Yes, hydrogen therapy has been studied in hundreds of peer-reviewed scientific papers since 2007, when a landmark paper in Nature Medicine demonstrated its selective antioxidant properties. Research includes cell studies, animal models, and human clinical trials across multiple health conditions, with the most robust evidence in areas of oxidative stress-related conditions."
                }
              },
              {
                "@type": "Question",
                "name": "How does molecular hydrogen work in the body?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Molecular hydrogen works through several mechanisms: 1) It selectively neutralizes harmful hydroxyl radicals while preserving beneficial reactive oxygen species needed for cell signaling, 2) It activates the Nrf2 pathway which regulates antioxidant proteins, 3) It reduces inflammation by suppressing pro-inflammatory cytokines, and 4) It influences cell signaling pathways related to metabolism and cell survival."
                }
              },
              {
                "@type": "Question",
                "name": "Is hydrogen water the same as alkaline water?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "No, hydrogen water and alkaline water are different. Hydrogen water contains dissolved molecular hydrogen gas (H2) that acts as a selective antioxidant in the body. Alkaline water has a higher pH level (typically 8-9) due to mineral content or electrolysis but doesn't necessarily contain therapeutic levels of molecular hydrogen. Some devices can produce both alkaline and hydrogen-rich water, but the benefits attributed to each are different."
                }
              },
              {
                "@type": "Question", 
                "name": "Which method of hydrogen therapy is most effective?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "The most effective method depends on the specific health condition being addressed. Hydrogen water is convenient for daily use and shows benefits for metabolic conditions. Hydrogen gas inhalation delivers higher concentrations and may be more effective for acute conditions or neurological applications. Hydrogen baths may be beneficial for skin conditions and relaxation. For serious medical conditions, clinical studies often use a combination of methods under professional supervision."
                }
              },
              {
                "@type": "Question",
                "name": "How can I find reliable hydrogen therapy research?",
                "acceptedAnswer": {
                  "@type": "Answer", 
                  "text": "Our Hydrogen Studies database provides access to peer-reviewed research on hydrogen therapy from reputable scientific journals. You can search by health condition, body system, or delivery method to find relevant studies. Each study includes key details such as publication information, methodology, and findings. For deeper research, we provide links to the original journal publications where available."
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
