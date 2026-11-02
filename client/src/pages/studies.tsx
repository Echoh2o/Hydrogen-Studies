import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { StudiesContent } from "./content/StudiesContent";

export default function Studies() {
  return (
    <>
      <Helmet>
        <title>Studies - Hydrogen Studies Research Database</title>
        <meta
          name="description"
          content="Browse and search through our comprehensive database of hydrogen gas studies and research papers."
        />
        <meta property="og:title" content="Studies - Hydrogen Studies Research Database" />
        <meta property="og:description" content="Browse and search through our comprehensive database of hydrogen gas studies and research papers." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/studies" />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href="https://hydrogenstudies.com/studies" />
      </Helmet>

      <SiteHeader />
      <StudiesContent />
      <Footer />
    </>
  );
}
