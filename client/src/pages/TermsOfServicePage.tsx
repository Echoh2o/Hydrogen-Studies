import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { TermsContent } from "./content/TermsContent";

export default function TermsOfServicePage() {
  const title = "Terms of Service - Hydrogen Studies";
  const description =
    "Terms of Service for Hydrogen Studies. Read our user agreement, content policies, and legal terms.";
  const url = "https://hydrogenstudies.com/terms";

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
        <link rel="canonical" href={url} />
      </Helmet>
      <SiteHeader />
      <TermsContent />
      <Footer />
    </div>
  );
}