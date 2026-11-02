import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { PrivacyContent } from "./content/PrivacyContent";

export default function PrivacyPolicyPage() {
  const title = "Privacy Policy - Hydrogen Studies";
  const description =
    "Privacy Policy for Hydrogen Studies. Learn how we collect, use, and protect your personal information.";
  const url = "https://hydrogenstudies.com/privacy";

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
      <PrivacyContent />
      <Footer />
    </div>
  );
}