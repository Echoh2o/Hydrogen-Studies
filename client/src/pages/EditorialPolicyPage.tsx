/**
 * Editorial Policy — stub required by PLAN.md 0.3 (full ≥600-word content
 * lands in Phase 4.2). States the ownership/independence position now so the
 * disclosure links in the footer resolve to a real page, not a 404.
 */
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { ScrollText } from "lucide-react";

export default function EditorialPolicyPage() {
  const title = "Editorial Policy - Hydrogen Studies";
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

      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Card className="p-8 shadow-lg bg-white">
          <div className="flex items-center mb-8">
            <ScrollText className="h-10 w-10 text-teal-600 mr-4" />
            <h1 className="text-3xl font-bold text-gray-900">Editorial Policy</h1>
          </div>

          <div className="prose prose-gray max-w-none space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Who funds this site</h2>
            <p>
              Hydrogen Studies is built and funded by Echo Technologies LLC, the maker of
              Echo Water hydrogen products. We state this on every page because sponsored
              science reporting is only trustworthy when the sponsorship is visible.
            </p>

            <h2 className="text-xl font-semibold text-gray-900">Editorial independence</h2>
            <p>
              Our research team selects and summarizes studies independently. Echo does not
              decide which studies are included, excluded, or how any study is described.
              Studies with unfavorable, null, or negative findings for hydrogen products are
              included on the same basis as favorable ones — and studies funded by industry,
              including any funded by Echo Technologies, are flagged as such.
            </p>

            <h2 className="text-xl font-semibold text-gray-900">What this site is not</h2>
            <p>
              Hydrogen Studies is an educational research database, not medical advice and
              not product marketing. Product mentions appear only in clearly labeled sponsor
              modules, never inside study summaries, and never on pages about diagnosed
              medical conditions.
            </p>

            <p className="text-sm text-gray-500 border-t pt-4">
              A fuller version of this policy — including our correction process, reviewer
              credentials, and update cadence — is being prepared and will replace this page.
              Questions in the meantime: <a href="/contact" className="text-teal-600">contact us</a>.
            </p>
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
