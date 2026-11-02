import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { AboutContent } from "./content/AboutContent";

export default function About() {
  return (
    <>
      <Helmet>
        <title>
          About Hydrogen Studies | The Definitive Molecular Hydrogen Research
          Database
        </title>
        <meta
          name="description"
          content="Discover the world's most comprehensive database of peer-reviewed hydrogen therapy research. Trusted resource for scientists, healthcare professionals and wellness enthusiasts seeking evidence-based information."
        />
        <meta
          name="keywords"
          content="molecular hydrogen research, hydrogen therapy evidence, hydrogen water studies, hydrogen gas health, h2 medicine database, hydrogen scientific research"
        />
        <link rel="canonical" href="https://hydrogenstudies.com/about" />

        {/* Open Graph Tags */}
        <meta
          property="og:title"
          content="About Hydrogen Studies Research Database | Evidence-Based Research"
        />
        <meta
          property="og:description"
          content="The definitive source for peer-reviewed research on molecular hydrogen therapy and its health applications across numerous medical conditions."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/about" />
        <meta property="og:image" content="/og-about-image.jpg" />

        {/* Twitter Card Tags */}
        <meta
          name="twitter:title"
          content="About Hydrogen Studies | Scientific Research Database"
        />
        <meta
          name="twitter:description"
          content="The most comprehensive resource for evidence-based hydrogen therapy research. Trusted by healthcare professionals worldwide."
        />

        {/* Schema.org structured data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: "About Hydrogen Studies Research Database",
            description:
              "The definitive source for peer-reviewed research on molecular hydrogen therapy and its health applications.",
            url: "https://hydrogenstudies.com/about",
            mainEntity: {
              "@type": "Organization",
              name: "Hydrogen Studies",
              description:
                "A comprehensive research database focused on molecular hydrogen gas and its applications in health and medicine.",
              url: "https://hydrogenstudies.com",
              logo: "https://hydrogenstudies.com/logo.png",
              foundingDate: "2023",
              founder: {
                "@type": "Person",
                name: "Hydrogen Health Research Team",
              },
              knowsAbout: [
                "Molecular Hydrogen",
                "Hydrogen Therapy",
                "Hydrogen Water",
                "Medical Research",
                "Health Benefits of H2",
              ],
            },
          })}
        </script>
      </Helmet>

      <SiteHeader />
      <AboutContent />
      <Footer />
    </>
  );
}
