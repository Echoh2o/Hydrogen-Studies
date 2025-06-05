import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HiArrowLeft, HiDownload, HiExternalLink, HiUser, HiBookOpen, HiCalendar, HiDocumentText } from "react-icons/hi";
import { Helmet } from "react-helmet";
import { useEffect } from "react";
import { StudyInfoPanel } from "@/components/StudyInfoPanel";

interface Study {
  id: number;
  title: string;
  plainLanguageTitle?: string;
  plain_language_title?: string;
  slug?: string;
  abstract: string;
  authors: string;
  journal: string;
  category: string;
  publishDate?: string;
  journalPublishDate?: string;
  year?: number;
  publishYear?: number;
  doi?: string;
  url?: string;
  pdfUrl?: string;
  pdf_url?: string;
  imageUrl?: string;
  image_url?: string;
  imageAlt?: string;
  image_alt?: string;
  methods?: string;
  results?: string;
  conclusion?: string;
  citations?: number;
  citationCount?: number;
  citation_count?: number;
  viewCount?: number;
  view_count?: number;
  authorAffiliations?: string;
  author_affiliations?: string;
  fundingSources?: string;
  funding_sources?: string;
  ethicalApproval?: string;
  ethical_approval?: string;
  trialRegistration?: string;
  trial_registration?: string;
  statisticalMethods?: string;
  statistical_methods?: string;
  supplementaryMaterials?: string;
  supplementary_materials?: string;
  fullText?: string;
  full_text?: string;
  fullTextHtml?: string;
  full_text_html?: string;
}

export default function SEOStudyPage() {
  const params = useParams();
  const [location, navigate] = useLocation();
  
  // Determine if we're accessing by slug or ID
  const isSlugRoute = location.includes('/study/') && !location.includes('/study/id/');
  const identifier = params.slug || params.id;
  
  // Fetch study data based on route type
  const { data: study, isLoading, error } = useQuery<Study>({
    queryKey: isSlugRoute ? [`/api/study-by-slug/${identifier}`] : [`/api/studies/${identifier}`],
    enabled: !!identifier,
  });

  // Redirect to slug-based URL if we loaded by ID and have a slug
  useEffect(() => {
    if (study && study.slug && !isSlugRoute && !location.includes('/study/id/')) {
      navigate(`/study/${study.slug}`, { replace: true });
    }
  }, [study, isSlugRoute, location, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="h-6 bg-neutral-200 rounded w-48 mb-6 animate-pulse"></div>
            <div className="h-10 bg-neutral-200 rounded w-full mb-4 animate-pulse"></div>
            <div className="flex space-x-4 mb-6">
              <div className="h-6 bg-neutral-200 rounded w-24 animate-pulse"></div>
              <div className="h-6 bg-neutral-200 rounded w-24 animate-pulse"></div>
            </div>
            <div className="space-y-2 mb-8">
              <div className="h-4 bg-neutral-200 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-neutral-200 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-neutral-200 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-neutral-200 rounded w-3/4 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="container mx-auto px-4 text-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 pb-6">
              <h1 className="text-xl font-bold mb-4">Study Not Found</h1>
              <p className="text-neutral-600 mb-6">
                {error instanceof Error 
                  ? error.message 
                  : "We couldn't find the study you're looking for. It may have been removed or the link is incorrect."}
              </p>
              <Link href="/recent">
                <Button>
                  <HiArrowLeft className="mr-2" />
                  Browse Recent Studies
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Get plain language title for SEO
  const plainTitle = study.plainLanguageTitle || study.plain_language_title;
  const seoTitle = plainTitle ? plainTitle.replace(/["""]/g, '') : study.title;
  const pageTitle = `${seoTitle} | Hydrogen Studies Research`;
  
  // Generate SEO-friendly URL for canonical link
  const canonicalUrl = study.slug 
    ? `https://hydrogenstudies.com/study/${study.slug}`
    : `https://hydrogenstudies.com/study/id/${study.id}`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={study.abstract?.substring(0, 160) + "..."} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={study.abstract?.substring(0, 160) + "..."} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonicalUrl} />
        <link rel="canonical" href={canonicalUrl} />
        
        {/* Article-specific meta tags */}
        <meta name="article:author" content={study.authors} />
        <meta name="article:published_time" content={study.journalPublishDate || study.publishDate} />
        <meta name="article:section" content={study.category} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={study.abstract?.substring(0, 160) + "..."} />
      </Helmet>

      <section className="bg-white py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content Column */}
              <div className="lg:col-span-2">
                {/* Breadcrumb */}
                <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex items-center text-sm text-neutral-500">
                <li className="inline-flex items-center">
                  <Link href="/">
                    <span className="hover:text-primary cursor-pointer">Home</span>
                  </Link>
                  <span className="mx-2" aria-hidden="true">/</span>
                </li>
                <li className="inline-flex items-center">
                  <Link href="/categories">
                    <span className="hover:text-primary cursor-pointer">Categories</span>
                  </Link>
                  <span className="mx-2" aria-hidden="true">/</span>
                </li>
                <li className="inline-flex items-center">
                  <Link href={`/category/${encodeURIComponent(study.category.toLowerCase())}`}>
                    <span className="hover:text-primary cursor-pointer">{study.category}</span>
                  </Link>
                  <span className="mx-2" aria-hidden="true">/</span>
                </li>
                <li className="inline-flex items-center" aria-current="page">
                  <span className="text-neutral-800">Study</span>
                </li>
              </ol>
            </nav>

            {/* SEO-Optimized Study Header */}
            <header className="mb-6 md:mb-8">
              {/* Category and date */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/15 w-fit">
                  {study.category}
                </Badge>
                {(study.year || study.publishYear) && (
                  <time dateTime={(study.year || study.publishYear)?.toString()} className="text-neutral-500 flex items-center text-sm">
                    <HiCalendar className="mr-1 w-4 h-4" aria-hidden="true" /> 
                    {study.year || study.publishYear}
                  </time>
                )}
              </div>
              
              {/* SEO-optimized title structure: Plain language as H1, original as H2 */}
              {plainTitle ? (
                <div className="mb-4">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 leading-tight text-primary">
                    {plainTitle.replace(/["""]/g, '')}
                  </h1>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-medium text-neutral-700 leading-snug">
                    {study.title}
                  </h2>
                </div>
              ) : (
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 leading-tight">
                  {study.title}
                </h1>
              )}
              
              {/* Study metadata */}
              <div className="space-y-2 md:space-y-0 md:flex md:flex-wrap md:items-center text-neutral-600 text-sm">
                <div className="flex items-center">
                  <HiUser className="mr-2 w-4 h-4 flex-shrink-0" aria-hidden="true" /> 
                  <span className="line-clamp-1">{study.authors}</span>
                </div>
                <div className="flex items-center md:ml-6">
                  <HiBookOpen className="mr-2 w-4 h-4 flex-shrink-0" aria-hidden="true" /> 
                  <span className="line-clamp-1">{study.journal}</span>
                </div>
                <div className="flex items-center md:ml-6">
                  <HiDocumentText className="mr-2 w-4 h-4 flex-shrink-0" aria-hidden="true" /> 
                  <span>{study.citations || study.citationCount || study.citation_count || 0} citations</span>
                </div>
              </div>
            </header>

            {/* Study Content */}
            <article className="bg-white border border-neutral-200 rounded-lg md:rounded-xl shadow-sm mb-6 md:mb-10">
              <div className="p-4 sm:p-6 md:p-8">
                {/* Study Image */}
                {(study.imageUrl || study.image_url) && 
                 !(study.imageUrl || study.image_url)?.includes('placehold.co') && 
                 !(study.imageUrl || study.image_url)?.includes('placeholder') && (
                  <section className="mb-8">
                    <figure className="rounded-lg overflow-hidden shadow-md">
                      <img 
                        src={
                          (study.imageUrl || study.image_url)?.startsWith('http') 
                            ? (study.imageUrl || study.image_url)
                            : `/${study.imageUrl || study.image_url}`
                        }
                        alt={study.imageAlt || study.image_alt || `Scientific visualization for ${study.title}`}
                        className="w-full h-auto max-h-96 object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                      <figcaption className="p-4 bg-neutral-50 border-t">
                        <p className="text-sm text-neutral-600 italic">
                          {(study.autoGeneratedImage || study.auto_generated_image) ? 
                            "AI-generated scientific visualization representing hydrogen mechanisms and therapeutic effects described in this study" : 
                            "Scientific illustration related to hydrogen research methodology and findings"}
                        </p>
                      </figcaption>
                    </figure>
                  </section>
                )}

                {/* Abstract */}
                <section className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">Abstract</h3>
                  <p className="text-neutral-700 leading-relaxed">{study.abstract}</p>
                </section>

                {/* Enhanced Methods, Results, Conclusion sections */}
                {study.methods && (
                  <section className="mb-8">
                    <h3 className="text-xl font-semibold mb-4 text-primary">Methods</h3>
                    <div className="text-neutral-700 leading-relaxed prose prose-neutral max-w-none">
                      <div dangerouslySetInnerHTML={{ 
                        __html: study.methods
                          .replace(/###\s/g, '<h4 class="text-lg font-semibold mt-6 mb-3 text-neutral-800">')
                          .replace(/####\s/g, '<h5 class="text-base font-medium mt-4 mb-2 text-neutral-800">')
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n\n/g, '</p><p class="mb-4">')
                          .replace(/^/, '<p class="mb-4">')
                          .replace(/$/, '</p>')
                      }} />
                    </div>
                  </section>
                )}

                {study.results && (
                  <section className="mb-8">
                    <h3 className="text-xl font-semibold mb-4 text-primary">Results</h3>
                    <div className="text-neutral-700 leading-relaxed prose prose-neutral max-w-none">
                      <div dangerouslySetInnerHTML={{ 
                        __html: study.results
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\*\s/g, '<li>')
                          .replace(/\n\n/g, '</p><p class="mb-4">')
                          .replace(/^/, '<p class="mb-4">')
                          .replace(/$/, '</p>')
                      }} />
                    </div>
                  </section>
                )}

                {study.conclusion && (
                  <section className="mb-8">
                    <h3 className="text-xl font-semibold mb-4 text-primary">Conclusion</h3>
                    <div className="text-neutral-700 leading-relaxed bg-neutral-50 p-4 rounded-lg border-l-4 border-primary">
                      <p>{study.conclusion}</p>
                    </div>
                  </section>
                )}

                {/* Additional Research Information Sections */}
                {(study.authorAffiliations || study.author_affiliations) && (
                  <section className="mb-8">
                    <h3 className="text-xl font-semibold mb-4 text-primary">Author Affiliations</h3>
                    <div className="text-neutral-700 leading-relaxed bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                      <p>{study.authorAffiliations || study.author_affiliations}</p>
                    </div>
                  </section>
                )}

                {(study.fundingSources || study.funding_sources) && (
                  <section className="mb-8">
                    <h3 className="text-xl font-semibold mb-4 text-primary">Funding Sources</h3>
                    <div className="text-neutral-700 leading-relaxed bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                      <p>{study.fundingSources || study.funding_sources}</p>
                    </div>
                  </section>
                )}

                {(study.statisticalMethods || study.statistical_methods) && (
                  <section className="mb-8">
                    <h3 className="text-xl font-semibold mb-4 text-primary">Statistical Methods</h3>
                    <div className="text-neutral-700 leading-relaxed">
                      <p>{study.statisticalMethods || study.statistical_methods}</p>
                    </div>
                  </section>
                )}

                {(study.ethicalApproval || study.ethical_approval) && (
                  <section className="mb-8">
                    <h3 className="text-xl font-semibold mb-4 text-primary">Ethical Approval</h3>
                    <div className="text-neutral-700 leading-relaxed bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                      <p>{study.ethicalApproval || study.ethical_approval}</p>
                    </div>
                  </section>
                )}

                {(study.trialRegistration || study.trial_registration) && (
                  <section className="mb-8">
                    <h3 className="text-xl font-semibold mb-4 text-primary">Trial Registration</h3>
                    <div className="text-neutral-700 leading-relaxed">
                      <p>{study.trialRegistration || study.trial_registration}</p>
                    </div>
                  </section>
                )}

                {(study.supplementaryMaterials || study.supplementary_materials) && (
                  <section className="mb-8">
                    <h3 className="text-xl font-semibold mb-4 text-primary">Supplementary Materials</h3>
                    <div className="text-neutral-700 leading-relaxed">
                      <p>{study.supplementaryMaterials || study.supplementary_materials}</p>
                    </div>
                  </section>
                )}

                {(study.fullText || study.full_text) && (
                  <section className="mb-8">
                    <h3 className="text-xl font-semibold mb-4 text-primary">Full Research Text</h3>
                    <div className="bg-white border border-neutral-200 rounded-lg shadow-sm">
                      <div className="p-6">
                        <div className="prose prose-neutral max-w-none text-neutral-800 leading-relaxed">
                          <div className="text-base whitespace-pre-line">
                            {(study.fullText || study.full_text)?.substring(0, 8000)}
                            {(study.fullText || study.full_text)?.length > 8000 && (
                              <span className="text-neutral-500 italic">
                                ... [Content continues in original publication]
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {(study.fullText || study.full_text)?.length > 8000 && (
                          <div className="mt-6 pt-4 border-t border-neutral-200">
                            <p className="text-sm text-neutral-600 mb-3">
                              This is a preview of the full research text. For the complete study including detailed methodology, statistical analysis, and references:
                            </p>
                            <div className="flex gap-3">
                              {study.doi && (
                                <Button variant="outline" size="sm" asChild>
                                  <a href={`https://doi.org/${study.doi}`} target="_blank" rel="noopener noreferrer">
                                    Read Complete Study
                                  </a>
                                </Button>
                              )}
                              {study.pdfUrl && (
                                <Button variant="outline" size="sm" asChild>
                                  <a href={study.pdfUrl} target="_blank" rel="noopener noreferrer">
                                    Download PDF
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 pt-6 border-t border-neutral-200">
                  {study.doi && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`https://doi.org/${study.doi}`} target="_blank" rel="noopener noreferrer">
                        <HiExternalLink className="mr-2 w-4 h-4" />
                        View DOI
                      </a>
                    </Button>
                  )}
                  {(study.pdfUrl || study.pdf_url) && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={study.pdfUrl || study.pdf_url} target="_blank" rel="noopener noreferrer">
                        <HiDownload className="mr-2 w-4 h-4" />
                        Download PDF
                      </a>
                    </Button>
                  )}
                  {study.url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={study.url} target="_blank" rel="noopener noreferrer">
                        <HiExternalLink className="mr-2 w-4 h-4" />
                        Original Source
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </article>

            {/* Back to studies */}
            <div className="text-center">
              <Link href="/recent">
                <Button variant="outline">
                  <HiArrowLeft className="mr-2" />
                  Back to Recent Studies
                </Button>
              </Link>
            </div>
              </div>

              {/* Study Information Panel - Sidebar */}
              <div className="lg:col-span-1">
                <StudyInfoPanel study={study} relatedStudies={[]} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}