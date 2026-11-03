import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Helmet } from "react-helmet";
import { HealthBenefitsContent } from "./content/HealthBenefitsContent";

// Head + chrome for the SPA route; the body is shared with the Next page.
export default function HealthBenefitsPage() {
  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>Molecular Hydrogen Research by Health Area - What the Evidence Shows</title>
        <meta name="description" content="What research on molecular hydrogen has looked at — heart, brain, exercise, inflammation, metabolism and skin — and how strong the evidence is in people." />
        <meta property="og:title" content="Molecular Hydrogen Research by Health Area - What the Evidence Shows" />
        <meta property="og:description" content="What research on molecular hydrogen has looked at — heart, brain, exercise, inflammation, metabolism and skin — and how strong the evidence is in people." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/learn/health-benefits" />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href="https://hydrogenstudies.com/learn/health-benefits" />
      </Helmet>
      <HealthBenefitsContent />
      <Footer />
    </>
  );
}
