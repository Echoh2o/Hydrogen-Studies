import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { DisclaimerContent } from "./content/DisclaimerContent";

export default function MedicalDisclaimerPage() {
  const title = "Medical Disclaimer - Hydrogen Studies";
  const description =
    "Important medical disclaimer for Hydrogen Studies. This website provides educational information only and is not a substitute for professional medical advice.";
  const url = "https://hydrogenstudies.com/disclaimer";

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
      <DisclaimerContent />
      <Footer />
    </div>
  );
}