/**
 * Methodology — PLAN.md 4.2. Text lives in shared/policy-pages.ts and is
 * served to every visitor by the Next front door; this SPA route is the
 * fallback and renders the same source.
 */
import { Helmet } from "react-helmet";
import { FlaskConical } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { METHODOLOGY } from "@shared/policy-pages";
import { PolicyPageContent } from "./content/PolicyPageContent";

export default function MethodologyPage() {
  const title = "Methodology | Hydrogen Studies";
  const description =
    "How studies enter the Hydrogen Studies database, how summaries are drafted and reviewed, and how funding and conflicts of interest are recorded.";
  const url = "https://hydrogenstudies.com/methodology";

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
      <PolicyPageContent page={METHODOLOGY} icon={FlaskConical} />
      <Footer />
    </div>
  );
}
