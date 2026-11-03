import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Helmet } from "react-helmet";
import { HydrogenBasicsContent } from "./content/HydrogenBasicsContent";

// Head + chrome for the SPA route; the body is shared with the Next page.
export default function HydrogenBasicsPage() {
  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>Hydrogen Basics - Understanding Molecular Hydrogen</title>
        <meta name="description" content="The basics of molecular hydrogen (H2): what it is, how it's taken, what research does and doesn't show, and what's known about safety." />
        <meta property="og:title" content="Hydrogen Basics - Understanding Molecular Hydrogen" />
        <meta property="og:description" content="The basics of molecular hydrogen (H2): what it is, how it's taken, what research does and doesn't show, and what's known about safety." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/learn/basics" />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href="https://hydrogenstudies.com/learn/basics" />
      </Helmet>
      <HydrogenBasicsContent />
      <Footer />
    </>
  );
}
