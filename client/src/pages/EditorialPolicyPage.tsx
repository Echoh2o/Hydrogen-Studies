/**
 * Editorial Policy — PLAN.md 4.2. Text lives in shared/policy-pages.ts and is
 * served to every visitor by the Next front door; this SPA route is the
 * fallback and renders the same source.
 */
import { Helmet } from "react-helmet";
import { ScrollText } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { EDITORIAL_POLICY } from "@shared/policy-pages";
import { PolicyPageContent } from "./content/PolicyPageContent";

export default function EditorialPolicyPage() {
  const title = "Editorial Policy | Hydrogen Studies";
  const description =
    "How Hydrogen Studies selects, summarizes, and reviews research — and how editorial independence from our funder, Echo Technologies LLC, works.";
  const url = "https://hydrogenstudies.com/editorial-policy";

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
      <PolicyPageContent page={EDITORIAL_POLICY} icon={ScrollText} />
      <Footer />
    </div>
  );
}
