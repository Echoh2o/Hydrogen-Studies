import { Helmet } from "react-helmet";
import { Separator } from "@/components/ui/separator";

export default function About() {
  return (
    <>
      <Helmet>
        <title>About Hydrogen Studies | The Definitive Molecular Hydrogen Research Database</title>
        <meta
          name="description"
          content="Discover the world's most comprehensive database of peer-reviewed hydrogen therapy research. Trusted resource for scientists, healthcare professionals and wellness enthusiasts seeking evidence-based information."
        />
        <meta name="keywords" content="molecular hydrogen research, hydrogen therapy evidence, hydrogen water studies, hydrogen gas health, h2 medicine database, hydrogen scientific research" />
        <link rel="canonical" href="https://hydrogenstudies.com/about" />
        
        {/* Open Graph Tags */}
        <meta property="og:title" content="About Hydrogen Studies Research Database | Evidence-Based Research" />
        <meta property="og:description" content="The definitive source for peer-reviewed research on molecular hydrogen therapy and its health applications across numerous medical conditions." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/about" />
        <meta property="og:image" content="/og-about-image.jpg" />
        
        {/* Twitter Card Tags */}
        <meta name="twitter:title" content="About Hydrogen Studies | Scientific Research Database" />
        <meta name="twitter:description" content="The most comprehensive resource for evidence-based hydrogen therapy research. Trusted by healthcare professionals worldwide." />
        
        {/* Schema.org structured data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AboutPage",
            "name": "About Hydrogen Studies Research Database",
            "description": "The definitive source for peer-reviewed research on molecular hydrogen therapy and its health applications.",
            "url": "https://hydrogenstudies.com/about",
            "mainEntity": {
              "@type": "Organization",
              "name": "Hydrogen Studies",
              "description": "A comprehensive research database focused on molecular hydrogen gas and its applications in health and medicine.",
              "url": "https://hydrogenstudies.com",
              "logo": "https://hydrogenstudies.com/logo.png",
              "foundingDate": "2023",
              "founder": {
                "@type": "Person",
                "name": "Hydrogen Health Research Team"
              },
              "knowsAbout": [
                "Molecular Hydrogen",
                "Hydrogen Therapy",
                "Hydrogen Water",
                "Medical Research",
                "Health Benefits of H2"
              ]
            }
          })}
        </script>
      </Helmet>
      
      <div className="bg-neutral-100 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <h1 className="text-3xl font-bold mb-4">About Hydrogen Studies</h1>
              <p className="text-lg text-neutral-600 mb-6">
                A complete research database focused on molecular hydrogen gas and its applications in health and medicine.
              </p>
              
              <Separator className="my-8" />
              
              <div className="space-y-8">
                <section>
                  <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
                  <p className="text-neutral-700 mb-4">
                    Hydrogen Studies is dedicated to aggregating and organizing the growing body of scientific research on molecular hydrogen (H₂) gas and its potential health benefits. Our mission is to make this research accessible to scientists, healthcare professionals, and the general public.
                  </p>
                  <p className="text-neutral-700">
                    By providing a comprehensive, user-friendly database of peer-reviewed studies, we aim to advance understanding of hydrogen's therapeutic potential and support evidence-based applications in healthcare.
                  </p>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold mb-4">What is Molecular Hydrogen?</h2>
                  <p className="text-neutral-700 mb-4">
                    Molecular hydrogen (H₂) is the smallest molecule in the universe, consisting of just two hydrogen atoms. Its unique properties allow it to rapidly diffuse through cell membranes and tissues, reaching cellular compartments that many other substances cannot.
                  </p>
                  <p className="text-neutral-700 mb-4">
                    Research suggests that hydrogen acts as a selective antioxidant, targeting harmful free radicals while preserving beneficial ones. It may also influence cell signaling pathways and gene expression related to inflammation, metabolism, and cell survival.
                  </p>
                  <p className="text-neutral-700">
                    Hydrogen can be administered in various forms, including hydrogen-rich water, hydrogen gas inhalation, hydrogen baths, and hydrogen-producing supplements.
                  </p>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold mb-4">Research Areas</h2>
                  <p className="text-neutral-700 mb-4">
                    Our database covers hydrogen research across numerous health categories, including:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
                    <li>Neurodegenerative diseases (Alzheimer's, Parkinson's, etc.)</li>
                    <li>Cardiovascular health and heart disease</li>
                    <li>Metabolism and diabetes</li>
                    <li>Inflammation and autoimmune conditions</li>
                    <li>Cancer research</li>
                    <li>Anti-aging and longevity</li>
                    <li>Sports medicine and exercise recovery</li>
                    <li>Gastrointestinal health</li>
                  </ul>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold mb-4">Our Approach</h2>
                  <p className="text-neutral-700 mb-4">
                    We maintain strict scientific standards in our database:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
                    <li>Focus on peer-reviewed research published in reputable scientific journals</li>
                    <li>Regular updates as new research emerges</li>
                    <li>Accurate categorization and tagging for ease of navigation</li>
                    <li>Clear summaries that maintain scientific accuracy</li>
                    <li>Links to original sources and citations</li>
                  </ul>
                </section>
                
                <section>
                  <h2 className="text-2xl font-bold mb-4">Disclaimer</h2>
                  <p className="text-neutral-700">
                    The information provided in this database is for educational and research purposes only. It is not intended as medical advice, diagnosis, or treatment recommendations. Always consult with a qualified healthcare provider before making any health-related decisions or starting any new treatments.
                  </p>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
