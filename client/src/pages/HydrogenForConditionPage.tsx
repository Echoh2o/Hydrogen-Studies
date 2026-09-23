import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Calendar, Book, Droplets, ChevronRight, ShieldCheck, BookOpen, ExternalLink, TrendingUp, FlaskConical, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";
import JsonLd, { generateFaqSchema } from "@/components/seo/JsonLd";
import { buildEchoUrl, echoProductUrl, ECHO_PRODUCTS } from "@shared/echo-products";
import { isBridgeAllowed } from "@shared/bridge-policy";
import { getHydrogenForTopic } from "@shared/hydrogen-for-topics";
import { abstractExcerpt, realContent } from "@shared/seo-markup";
import { trackOutboundClick } from "@/lib/analytics";
import { useEchoPageContext } from "@/hooks/use-echo-link";

// Topic records (name, meta, FAQs, bridge topic, sponsor products) live in
// shared/hydrogen-for-topics.ts so the bot renderer serves the same page.

/** Extract key findings from study data */
function extractKeyFindings(studies: any[]): string[] {
  const findings: string[] = [];
  for (const study of studies.slice(0, 20)) {
    if (study.conclusions) {
      findings.push(study.conclusions.substring(0, 200));
    } else if (study.results) {
      findings.push(study.results.substring(0, 200));
    } else if (study.plainLanguageSummary) {
      findings.push(study.plainLanguageSummary.substring(0, 200));
    }
  }
  return findings.slice(0, 5);
}

/** Get year range from studies */
function getYearRange(studies: any[]): string {
  const years = studies
    .map((s: any) => s.publishDate ? new Date(s.publishDate).getFullYear() : null)
    .filter(Boolean) as number[];
  if (years.length === 0) return "";
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? `${min}` : `${min}–${max}`;
}

export default function HydrogenForConditionPage() {
  const params = useParams();
  const conditionSlug = (params as any).condition || "";
  const condition = getHydrogenForTopic(conditionSlug);
  const echoCtx = useEchoPageContext();

  // Fetch studies for this condition
  const { data: studiesResponse, isLoading } = useQuery({
    queryKey: [`/api/consumer-categories/studies`, conditionSlug],
    queryFn: async () => {
      const categoryName = condition?.name || conditionSlug;
      const res = await fetch(`/api/consumer-categories/studies?model=condition&category=${encodeURIComponent(categoryName)}`);
      if (!res.ok) throw new Error("Failed to fetch studies");
      return res.json();
    },
    enabled: !!condition,
  });

  const studies = studiesResponse?.data || [];
  const keyFindings = extractKeyFindings(studies);
  const yearRange = getYearRange(studies);
  const humanStudies = studies.filter((s: any) =>
    s.studyDesign?.toLowerCase()?.includes("human") ||
    s.studyDesign?.toLowerCase()?.includes("clinical") ||
    s.studyDesign?.toLowerCase()?.includes("randomized")
  );

  if (!condition) {
    return (
      <>
        <SiteHeader />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Condition Not Found</h1>
            <p className="text-gray-600 mb-6">We don't have a dedicated page for this condition yet.</p>
            <Link href="/explore-by-condition">
              <Button>Browse All Conditions</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const conditionName = condition.name;
  // Same meta as the bot renderer (seo-bot-middleware resolveStaticPageMeta).
  const pageTitle = condition.metaTitle;
  const pageDescription = condition.metaDescription;
  const canonicalUrl = `https://hydrogenstudies.com/hydrogen-for/${condition.slug}`;
  // PLAN.md Appendix E: product content only on allowlisted topics. Disease
  // and gray-area topics (bridgeTopic null) get no product cards and no shop CTA.
  const showBridge = isBridgeAllowed(condition.bridgeTopic) && condition.products.length > 0;
  const echoStoreUrl = buildEchoUrl("/", echoCtx);

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>
      <JsonLd
        type="FAQPage"
        data={generateFaqSchema(condition.faqs)}
      />

      <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <PageBreadcrumb items={[
            { label: "Home", href: "/" },
            { label: "Conditions", href: "/explore-by-condition" },
            { label: `Hydrogen for ${conditionName}` },
          ]} />
        </div>

        {/* Hero */}
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-4 bg-teal-100 text-teal-800 px-4 py-1">
              {condition.bodySystem}
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Hydrogen for {conditionName}
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              {studies.length > 0
                ? `We've curated ${studies.length} peer-reviewed studies${yearRange ? ` spanning ${yearRange}` : ""} examining how molecular hydrogen may support ${conditionName.toLowerCase()}.`
                : `Explore the scientific research on hydrogen therapy for ${conditionName.toLowerCase()}.`}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Badge variant="outline" className="px-4 py-2">
                <Book className="h-4 w-4 mr-1" />
                {studies.length || "Multiple"} Studies
              </Badge>
              {humanStudies.length > 0 && (
                <Badge variant="outline" className="px-4 py-2">
                  <FlaskConical className="h-4 w-4 mr-1" />
                  {humanStudies.length} Human Trials
                </Badge>
              )}
              <Badge variant="outline" className="px-4 py-2">
                <ShieldCheck className="h-4 w-4 mr-1" />
                Peer-Reviewed
              </Badge>
            </div>
          </div>
        </section>

        {/* Key Findings from Study Data */}
        {keyFindings.length > 0 && (
          <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-teal-600" />
                Key Research Findings
              </h2>
              <div className="space-y-4">
                {keyFindings.map((finding, index) => (
                  <Card key={index} className="border-l-4 border-l-teal-500">
                    <CardContent className="p-4">
                      <p className="text-gray-700 text-sm leading-relaxed">
                        "{finding.endsWith('.') ? finding : finding + '...'}"
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        — From study #{studies[index]?.id}: {studies[index]?.journal || "Peer-reviewed journal"}
                        {studies[index]?.publishDate && ` (${new Date(studies[index].publishDate).getFullYear()})`}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Studies Section */}
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              Research Studies ({studies.length})
            </h2>

            {isLoading ? (
              <div className="text-center py-12">
                <Droplets className="h-12 w-12 text-teal-500 animate-pulse mx-auto mb-4" />
                <p className="text-gray-600">Loading studies...</p>
              </div>
            ) : studies.length === 0 ? (
              <Card className="text-center p-8">
                <p className="text-gray-600 mb-4">
                  We're still building our database for this condition. Try searching for related studies.
                </p>
                <Link href={`/search?q=${encodeURIComponent(conditionName)}`}>
                  <Button>Search Studies</Button>
                </Link>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {studies.slice(0, 12).map((study: any) => (
                  <Link key={study.id} href={study.slug ? `/study/${study.slug}` : `/study/id/${study.id}`}>
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                      <CardHeader>
                        <CardTitle className="text-lg line-clamp-2">
                          {study.plainLanguageTitle || study.title}
                        </CardTitle>
                        <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                          {study.publishDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(study.publishDate).getFullYear()}
                            </span>
                          )}
                          {study.journal && (
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <BookOpen className="h-3 w-3 flex-shrink-0" />
                              {study.journal}
                            </span>
                          )}
                          {study.outcome && (
                            <Badge variant={study.outcome === "Positive" ? "default" : "secondary"} className="text-xs">
                              {study.outcome}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="line-clamp-3">
                          {/* line-clamp is visual only — the DOM must never
                              carry a full abstract (≤300-char excerpt rule). */}
                          {realContent(study.plainLanguageSummary) || abstractExcerpt(study.abstract) || "View this study for details."}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            {studies.length > 12 && (
              <div className="text-center">
                <Link href={`/search?q=${encodeURIComponent(conditionName)}`}>
                  <Button variant="outline" size="lg">
                    View All {studies.length} Studies
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Sponsor card — Appendix E allowlisted topics only (showBridge). */}
        {showBridge && (
          <section
            className="py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-50 to-cyan-50"
            aria-label="Sponsor"
          >
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
                From our sponsor, Echo Water
              </h2>
              <p className="text-gray-600 text-center mb-8">
                Hydrogen Studies is funded by Echo Technologies LLC, which makes these products.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                {condition.products.map((p) => {
                  const product = ECHO_PRODUCTS[p.key];
                  if (!product) return null;
                  const url = echoProductUrl(product, echoCtx);
                  return (
                    <Card key={p.key} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Droplets className="h-6 w-6 text-teal-600" />
                          <CardTitle className="text-lg">{p.name}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-gray-600 text-sm mb-4">{p.reason}</p>
                        <a
                          href={url}
                          target="_blank"
                          rel="sponsored noopener"
                          onClick={() => trackOutboundClick(url, "condition-products")}
                        >
                          <Button className="w-full">
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            View on Echo Water
                            <ExternalLink className="h-3 w-3 ml-2" />
                          </Button>
                        </a>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* FAQ Section */}
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              {condition.faqs.map((faq, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg">{faq.question}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA. The shop/compare-products buttons are product
            content → allowlisted topics only; every topic keeps the
            research links. */}
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <Card className="max-w-4xl mx-auto bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">
                {showBridge ? "Experience Hydrogen Water from Echo Water" : "Keep Exploring the Research"}
              </h2>
              <p className="text-lg mb-6 opacity-90">
                {showBridge
                  ? "Hydrogen Studies is funded by Echo Technologies LLC, the maker of Echo Water products."
                  : "Read how hydrogen is studied, or browse every study in the database."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {showBridge && (
                  <>
                    <a
                      href={echoStoreUrl}
                      target="_blank"
                      rel="sponsored noopener"
                      onClick={() => trackOutboundClick(echoStoreUrl, "condition-cta")}
                    >
                      <Button variant="secondary" size="lg">
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Shop Echo Water
                      </Button>
                    </a>
                    <Link href="/products">
                      <Button variant="outline" size="lg" className="text-white border-white hover:bg-white hover:text-teal-600">
                        Compare Products
                      </Button>
                    </Link>
                  </>
                )}
                <Link href="/hydrogen-therapy-guide">
                  <Button variant="outline" size="lg" className="text-white border-white hover:bg-white hover:text-teal-600">
                    Read the Science Guide
                  </Button>
                </Link>
                {!showBridge && (
                  <Link href="/studies">
                    <Button variant="outline" size="lg" className="text-white border-white hover:bg-white hover:text-teal-600">
                      Browse All Studies
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Disclaimer */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-sm text-gray-500 text-center">
            <strong>Disclaimer:</strong> The information on this page is derived from published scientific research and is for educational purposes only.
            It is not intended to diagnose, treat, cure, or prevent any disease. Individual results may vary.
            Consult your healthcare provider before starting any new health regimen.
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
}
