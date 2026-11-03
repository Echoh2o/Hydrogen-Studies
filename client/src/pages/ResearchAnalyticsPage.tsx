import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Helmet } from "react-helmet";
import { ResearchAnalyticsContent } from "./content/ResearchAnalyticsContent";

// Head + chrome for the SPA route; the body is shared with the Next page.
export default function ResearchAnalyticsPage() {
  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>
          Research Analytics & Citation Networks - Hydrogen Studies Database
        </title>
        <meta
          name="description"
          content="Advanced analytics, citation networks, and timeline visualizations of hydrogen health research. Explore publication trends, citation patterns, and research impact."
        />
        <meta property="og:title" content="Research Analytics & Citation Networks - Hydrogen Studies Database" />
        <meta property="og:description" content="Advanced analytics, citation networks, and timeline visualizations of hydrogen health research. Explore publication trends, citation patterns, and research impact." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/research-analytics" />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href="https://hydrogenstudies.com/research-analytics" />
      </Helmet>
      <ResearchAnalyticsContent />
      <Footer />
    </>
  );
}
