/**
 * Methodology — stub required by PLAN.md 0.3 (full ≥600-word content lands in
 * Phase 4.2). Describes how summaries are produced honestly — including the
 * AI-assisted drafting step — so the footer link resolves to a real page.
 */
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { FlaskConical } from "lucide-react";

export default function MethodologyPage() {
  const title = "Methodology - Hydrogen Studies";
  const description =
    "How studies enter the Hydrogen Studies database, how summaries are drafted and reviewed, and how funding sources and conflicts of interest are recorded.";
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

      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Card className="p-8 shadow-lg bg-white">
          <div className="flex items-center mb-8">
            <FlaskConical className="h-10 w-10 text-teal-600 mr-4" />
            <h1 className="text-3xl font-bold text-gray-900">Methodology</h1>
          </div>

          <div className="prose prose-gray max-w-none space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">How studies enter the database</h2>
            <p>
              Studies are discovered from PubMed, Europe PMC, CrossRef, and related indexes
              using hydrogen-therapy search terms, then screened before publication. Every
              study page links its primary source (DOI, PubMed, or PMC) so claims can be
              checked against the original paper. Retractions are monitored and flagged.
            </p>

            <h2 className="text-xl font-semibold text-gray-900">How summaries are produced</h2>
            <p>
              Summaries are drafted with AI assistance from the study abstract or full text,
              then reviewed before publication. We are transparent about this because we
              believe the review step, not the drafting tool, is what makes a summary
              trustworthy. Named reviewer credentials and per-study review dates are being
              rolled out across the database.
            </p>

            <h2 className="text-xl font-semibold text-gray-900">Funding and conflicts</h2>
            <p>
              Hydrogen Studies is funded by Echo Technologies LLC. Study funding sources and
              conflicts of interest are being recorded as structured, filterable data for
              every study — including studies funded by Echo Technologies or other industry
              sources, which are flagged as industry-funded.
            </p>

            <p className="text-sm text-gray-500 border-t pt-4">
              A fuller version — inclusion criteria, evidence grading, update cadence, and
              the corrections process — is being prepared and will replace this page.
            </p>
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
