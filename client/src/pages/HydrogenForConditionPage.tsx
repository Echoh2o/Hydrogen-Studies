import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Calendar, Book, Droplets, ChevronRight, ShieldCheck, BookOpen, Star, ExternalLink, TrendingUp, FlaskConical, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";
import JsonLd, { generateFaqSchema } from "@/components/seo/JsonLd";
import { buildEchoUrl, echoProductUrl, ECHO_PRODUCTS } from "@shared/echo-products";
import { trackOutboundClick } from "@/lib/analytics";

const echoStoreUrl = buildEchoUrl("/", { content: "condition-cta" });

// Map URL slugs to condition names, body systems, and recommended Echo Water products
const conditionConfig: Record<string, {
  name: string;
  bodySystem: string;
  searchTerms: string[];
  recommendedProducts: Array<{ name: string; url: string; reason: string }>;
  faqs: Array<{ question: string; answer: string }>;
}> = {
  "heart-disease": {
    name: "Heart Disease",
    bodySystem: "Cardiovascular System",
    searchTerms: ["cardiovascular", "heart", "cardiac", "hypertension"],
    recommendedProducts: [
      { name: "Echo Ultimate™ Hydrogen Water Machine", url: echoProductUrl(ECHO_PRODUCTS.ultimate, { content: "condition-products" }), reason: "Countertop hydrogen water for daily heart health support" },
      { name: "Echo Flask Hydrogen Water Bottle", url: echoProductUrl(ECHO_PRODUCTS.flask, { content: "condition-products" }), reason: "Portable hydrogen water on the go" },
    ],
    faqs: [
      { question: "Can hydrogen water help with heart disease?", answer: "Multiple peer-reviewed studies suggest molecular hydrogen may support cardiovascular health by reducing oxidative stress, improving endothelial function, and lowering inflammation markers associated with heart disease. Always consult your cardiologist." },
      { question: "How does hydrogen therapy support heart health?", answer: "Hydrogen acts as a selective antioxidant that targets harmful hydroxyl radicals in cardiac tissue. Studies show it may help protect against ischemia-reperfusion injury and reduce markers of cardiovascular inflammation." },
      { question: "What delivery method is best for heart health?", answer: "Most cardiovascular studies used hydrogen-rich water as the delivery method. Drinking hydrogen water daily is the most studied approach for heart health benefits." },
    ],
  },
  "diabetes": {
    name: "Diabetes & Metabolic Health",
    bodySystem: "Endocrine System",
    searchTerms: ["diabetes", "metabolic", "insulin", "blood sugar", "glucose"],
    recommendedProducts: [
      { name: "Echo Ultimate™ Hydrogen Water Machine", url: echoProductUrl(ECHO_PRODUCTS.ultimate, { content: "condition-products" }), reason: "High-concentration hydrogen water for daily metabolic support" },
      { name: "Hydrogen Prebiotic Stick Pack", url: echoProductUrl(ECHO_PRODUCTS.prebiotic, { content: "condition-products" }), reason: "Combines hydrogen with prebiotics for gut-metabolic health" },
    ],
    faqs: [
      { question: "Can hydrogen water help manage diabetes?", answer: "Several clinical studies have shown that hydrogen-rich water may help improve insulin sensitivity and reduce oxidative stress markers in patients with type 2 diabetes and metabolic syndrome. It is not a replacement for medication." },
      { question: "What does the research say about hydrogen and blood sugar?", answer: "Research suggests molecular hydrogen may help regulate glucose metabolism through its anti-inflammatory and antioxidant properties, potentially supporting better blood sugar control alongside standard care." },
    ],
  },
  "brain-health": {
    name: "Brain & Mental Health",
    bodySystem: "Nervous System",
    searchTerms: ["brain", "cognitive", "neuro", "alzheimer", "parkinson", "neuroprotective"],
    recommendedProducts: [
      { name: "Echo Ultimate™ Hydrogen Water Machine", url: echoProductUrl(ECHO_PRODUCTS.ultimate, { content: "condition-products" }), reason: "Daily hydrogen water for neuroprotective benefits" },
      { name: "Echo Refresh Hydrogen Inhalation Machine", url: echoProductUrl(ECHO_PRODUCTS.refresh, { content: "condition-products" }), reason: "Hydrogen inhalation for rapid bloodstream delivery to the brain" },
    ],
    faqs: [
      { question: "Can hydrogen therapy help with brain health?", answer: "Studies show molecular hydrogen can cross the blood-brain barrier and may provide neuroprotective effects. Research has explored its potential benefits for cognitive function, memory, and protection against neurodegenerative conditions." },
      { question: "Is hydrogen water good for cognitive function?", answer: "Several studies suggest hydrogen-rich water may support cognitive function by reducing oxidative stress and neuroinflammation, which are key factors in cognitive decline." },
      { question: "Which hydrogen delivery method is best for brain health?", answer: "Both hydrogen water and hydrogen inhalation have been studied for brain health. Inhalation may provide more rapid delivery, while hydrogen water offers convenient daily use." },
    ],
  },
  "inflammation": {
    name: "Arthritis & Inflammation",
    bodySystem: "Immune System",
    searchTerms: ["inflammation", "arthritis", "anti-inflammatory", "rheumatoid", "joint"],
    recommendedProducts: [
      { name: "Echo Revive Hydrogen Bath Water Machine", url: echoProductUrl(ECHO_PRODUCTS.revive, { content: "condition-products" }), reason: "Hydrogen baths for whole-body anti-inflammatory relief" },
      { name: "Echo Ultimate™ Hydrogen Water Machine", url: echoProductUrl(ECHO_PRODUCTS.ultimate, { content: "condition-products" }), reason: "Daily hydrogen water for systemic inflammation reduction" },
    ],
    faqs: [
      { question: "Does hydrogen water reduce inflammation?", answer: "Multiple studies demonstrate that molecular hydrogen has anti-inflammatory properties. It may help modulate inflammatory responses by regulating pro-inflammatory cytokines and reducing oxidative stress." },
      { question: "Can hydrogen therapy help with arthritis?", answer: "Research suggests hydrogen-rich water and hydrogen baths may help reduce inflammation markers and improve symptoms in patients with rheumatoid arthritis and other inflammatory joint conditions." },
    ],
  },
  "cancer-support": {
    name: "Cancer Supportive Care",
    bodySystem: "Immune System",
    searchTerms: ["cancer", "tumor", "chemotherapy", "radiation", "oncology"],
    recommendedProducts: [
      { name: "Echo Ultimate™ Hydrogen Water Machine", url: echoProductUrl(ECHO_PRODUCTS.ultimate, { content: "condition-products" }), reason: "Quality-of-life support during cancer treatment" },
      { name: "Echo Refresh Hydrogen Inhalation Machine", url: echoProductUrl(ECHO_PRODUCTS.refresh, { content: "condition-products" }), reason: "Hydrogen inhalation studied for treatment side effect reduction" },
    ],
    faqs: [
      { question: "Can hydrogen water help cancer patients?", answer: "Research suggests molecular hydrogen may help reduce side effects of cancer treatments like chemotherapy and radiation. It is being studied as a complementary approach to improve quality of life during cancer therapy, not as a cancer treatment itself." },
      { question: "Is hydrogen therapy safe during cancer treatment?", answer: "Studies have generally shown hydrogen to be safe and well-tolerated. However, patients should always consult their oncologist before adding any complementary therapy to their cancer treatment plan." },
    ],
  },
  "athletic-performance": {
    name: "Athletic Performance & Recovery",
    bodySystem: "Musculoskeletal System",
    searchTerms: ["exercise", "athlete", "performance", "recovery", "fatigue", "muscle"],
    recommendedProducts: [
      { name: "Echo Flask Hydrogen Water Bottle", url: echoProductUrl(ECHO_PRODUCTS.flask, { content: "condition-products" }), reason: "Portable hydrogen water for pre/post-workout hydration" },
      { name: "Echo Revive Hydrogen Bath Water Machine", url: echoProductUrl(ECHO_PRODUCTS.revive, { content: "condition-products" }), reason: "Hydrogen baths for muscle recovery and soreness relief" },
    ],
    faqs: [
      { question: "Does hydrogen water improve athletic performance?", answer: "Several studies have shown that hydrogen-rich water may reduce exercise-induced fatigue, decrease blood lactate levels, and improve endurance capacity in athletes." },
      { question: "How does hydrogen water help with recovery?", answer: "Research suggests hydrogen water may accelerate recovery by reducing muscle damage markers (like creatine kinase), lowering oxidative stress from intense exercise, and supporting anti-inflammatory processes." },
    ],
  },
  "skin-health": {
    name: "Skin Health & Anti-Aging",
    bodySystem: "Integumentary System",
    searchTerms: ["skin", "dermatology", "UV", "wrinkle", "aging", "collagen"],
    recommendedProducts: [
      { name: "Echo Revive Hydrogen Bath Water Machine", url: echoProductUrl(ECHO_PRODUCTS.revive, { content: "condition-products" }), reason: "Hydrogen baths for whole-body skin rejuvenation" },
      { name: "Echo Ultimate™ Hydrogen Water Machine", url: echoProductUrl(ECHO_PRODUCTS.ultimate, { content: "condition-products" }), reason: "Acidic water output for skincare applications" },
    ],
    faqs: [
      { question: "Can hydrogen water improve skin health?", answer: "Studies suggest molecular hydrogen may help protect skin from UV damage, reduce oxidative stress that contributes to aging, and promote better skin hydration and elasticity." },
      { question: "How does hydrogen therapy help with anti-aging?", answer: "Hydrogen acts as a selective antioxidant that targets the most harmful free radicals responsible for cellular aging. Research shows it may help reduce wrinkles, improve skin tone, and protect against environmental skin damage." },
    ],
  },
  "gut-health": {
    name: "Digestive Health",
    bodySystem: "Digestive System",
    searchTerms: ["digestive", "gut", "liver", "gastric", "intestinal", "microbiome"],
    recommendedProducts: [
      { name: "Hydrogen Prebiotic Stick Pack", url: echoProductUrl(ECHO_PRODUCTS.prebiotic, { content: "condition-products" }), reason: "Hydrogen + prebiotics for gut health synergy" },
      { name: "Echo Ultimate™ Hydrogen Water Machine", url: echoProductUrl(ECHO_PRODUCTS.ultimate, { content: "condition-products" }), reason: "Daily hydrogen water for digestive support" },
    ],
    faqs: [
      { question: "Can hydrogen water improve gut health?", answer: "Research suggests molecular hydrogen may help protect the gastrointestinal lining, reduce digestive inflammation, and support gut barrier function. Some studies also show potential benefits for the gut microbiome." },
      { question: "Is hydrogen water good for digestive issues?", answer: "Studies have explored hydrogen-rich water for conditions like gastritis, colitis, and liver health. The anti-inflammatory and antioxidant properties of H2 may help alleviate symptoms of various digestive disorders." },
    ],
  },
  "kidney-health": {
    name: "Kidney Health",
    bodySystem: "Urinary System",
    searchTerms: ["kidney", "renal", "nephro"],
    recommendedProducts: [
      { name: "Echo Ultimate™ Hydrogen Water Machine", url: echoProductUrl(ECHO_PRODUCTS.ultimate, { content: "condition-products" }), reason: "Filtered hydrogen water for renal support" },
    ],
    faqs: [
      { question: "Can hydrogen water help protect kidneys?", answer: "Research suggests molecular hydrogen may have renoprotective effects, helping to reduce oxidative damage to kidney tissue and potentially improving renal function markers." },
      { question: "What studies exist on hydrogen and kidney health?", answer: "Several studies have examined hydrogen-rich water for kidney protection, particularly in cases of drug-induced nephrotoxicity and ischemia-reperfusion injury. Results generally show reduced oxidative stress markers." },
    ],
  },
  "lung-health": {
    name: "Lung & Respiratory Health",
    bodySystem: "Respiratory System",
    searchTerms: ["lung", "respiratory", "pulmonary", "asthma", "COPD"],
    recommendedProducts: [
      { name: "Echo Refresh Hydrogen Inhalation Machine", url: echoProductUrl(ECHO_PRODUCTS.refresh, { content: "condition-products" }), reason: "Direct hydrogen inhalation for respiratory support" },
      { name: "Echo Ultimate™ Hydrogen Water Machine", url: echoProductUrl(ECHO_PRODUCTS.ultimate, { content: "condition-products" }), reason: "Complementary hydrogen water intake" },
    ],
    faqs: [
      { question: "Can hydrogen therapy help with lung conditions?", answer: "Studies suggest hydrogen inhalation and hydrogen-rich water may help reduce lung inflammation and oxidative stress. Research has explored its potential benefits for various respiratory conditions." },
      { question: "Is hydrogen inhalation safe for the lungs?", answer: "Hydrogen gas has been studied in clinical settings and is generally considered safe at therapeutic concentrations. Hydrogen inhalation therapy is being researched as a complementary approach for respiratory support." },
    ],
  },
};

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
  const condition = conditionConfig[conditionSlug];

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
  const pageTitle = `Hydrogen for ${conditionName} - ${studies.length || "Scientific"} Research Studies`;
  const pageDescription = `Explore ${studies.length || "peer-reviewed"} studies on hydrogen therapy for ${conditionName.toLowerCase()}. Evidence-based research on how molecular hydrogen may support ${conditionName.toLowerCase()}.`;

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://hydrogenstudies.com/hydrogen-for/${conditionSlug}`} />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href={`https://hydrogenstudies.com/hydrogen-for/${conditionSlug}`} />
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
                  <Link key={study.id} href={`/study/id/${study.id}`}>
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
                          {study.plainLanguageSummary || study.abstract || "View this study for details."}
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

        {/* Recommended Echo Water Products */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-50 to-cyan-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Recommended Products for {conditionName}
            </h2>
            <p className="text-gray-600 text-center mb-8">
              Echo Water hydrogen products used in research studies
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {condition.recommendedProducts.map((product, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Droplets className="h-6 w-6 text-teal-600" />
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 text-sm mb-4">{product.reason}</p>
                    <div className="flex items-center gap-2 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className="h-4 w-4 text-yellow-400 fill-current" />
                      ))}
                      <span className="text-sm text-gray-500">Top Rated</span>
                    </div>
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener"
                      onClick={() => trackOutboundClick(product.url, "condition-products")}
                    >
                      <Button className="w-full">
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        View on Echo Water
                        <ExternalLink className="h-3 w-3 ml-2" />
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

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

        {/* CTA to Echo Water */}
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <Card className="max-w-4xl mx-auto bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">
                Experience Hydrogen Water from Echo Water
              </h2>
              <p className="text-lg mb-6 opacity-90">
                The premier provider of research-backed hydrogen water solutions. Trusted by thousands worldwide.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href={echoStoreUrl}
                  target="_blank"
                  rel="noopener"
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
                <Link href="/hydrogen-therapy-guide">
                  <Button variant="outline" size="lg" className="text-white border-white hover:bg-white hover:text-teal-600">
                    Read the Science Guide
                  </Button>
                </Link>
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
