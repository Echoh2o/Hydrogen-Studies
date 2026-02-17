import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HiArrowLeft, HiExternalLink } from "react-icons/hi";
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";

const SimpleStudyPage = () => {
  const { id } = useParams();
  const studyId = id ? parseInt(id) : 0;

  const {
    data: study,
    isLoading,
    error,
  } = useQuery<any>({
    queryKey: [`/api/studies/${studyId}`],
  });

  if (isLoading) {
    return (
      <>
        <SiteHeader />
        <div className="min-h-screen bg-gray-50 py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-48 mb-6"></div>
                <div className="h-10 bg-gray-200 rounded w-full mb-4"></div>
                <div className="h-64 bg-gray-200 rounded w-full mb-6"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error || !study) {
    return (
      <>
        <SiteHeader />
        <div className="min-h-screen bg-gray-50 py-12">
          <div className="container mx-auto px-4 text-center">
            <Card className="max-w-md mx-auto">
              <CardContent className="pt-6 pb-6">
                <h1 className="text-xl font-bold mb-4">Study Not Found</h1>
                <p className="text-gray-600 mb-6">
                  We couldn't find the study you're looking for.
                </p>
                <Link href="/studies">
                  <Button>
                    <HiArrowLeft className="mr-2" />
                    Back to Studies
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>{study.title} | Hydrogen Studies</title>
        <meta
          name="description"
          content={study.abstract?.substring(0, 160) + "..."}
        />
      </Helmet>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Back Button */}
            <div className="mb-6">
              <Link href="/studies">
                <Button variant="outline" className="flex items-center gap-2">
                  <HiArrowLeft className="w-4 h-4" />
                  Back to Studies
                </Button>
              </Link>
            </div>

            {/* Main Study Card */}
            <Card className="mb-8">
              <CardContent className="p-8">
                {/* Study Header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary">Study #{studyId}</Badge>
                    <Badge>{study.category}</Badge>
                    {study.publishYear && (
                      <Badge variant="outline">{study.publishYear}</Badge>
                    )}
                  </div>

                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                    {study.title}
                  </h1>

                  {study.authors && (
                    <p className="text-gray-600 mb-2">
                      <strong>Authors:</strong> {study.authors}
                    </p>
                  )}

                  {study.journal && (
                    <p className="text-gray-600">
                      <strong>Journal:</strong> {study.journal}
                    </p>
                  )}
                </div>

                {/* Study Image - Simple approach */}
                <div className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">
                    Study Visualization
                  </h2>

                  {/* Try to display image if available */}
                  {(study.imageUrl || study.image_url) &&
                  !study.imageUrl?.includes("placehold.co") &&
                  !study.image_url?.includes("placehold.co") ? (
                    <div className="rounded-lg overflow-hidden shadow-md">
                      <img
                        src={study.imageUrl || study.image_url}
                        alt={
                          study.imageAlt ||
                          study.image_alt ||
                          `Visualization for ${study.title}`
                        }
                        className="w-full h-auto max-h-96 object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    </div>
                  ) : (
                    /* Simple fallback - no complex components */
                    <div className="bg-teal-50 border-2 border-dashed border-teal-200 rounded-lg p-8 text-center">
                      <div className="text-teal-800 mb-2">
                        <div className="text-lg font-semibold">
                          Study #{studyId}
                        </div>
                        <div className="text-sm text-teal-600 mt-2">
                          {study.title}
                        </div>
                        <div className="text-xs text-teal-500 mt-2">
                          Hydrogen Research Study
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Abstract */}
                <div className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Abstract</h2>
                  <div className="prose max-w-none text-gray-700">
                    {study.abstract || "Abstract not available for this study."}
                  </div>
                </div>

                {/* Study Details */}
                {(study.methods || study.results || study.conclusion) && (
                  <div className="grid md:grid-cols-3 gap-6 mb-8">
                    {study.methods && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">
                          Methods
                        </h3>
                        <p className="text-sm text-gray-600">{study.methods}</p>
                      </div>
                    )}
                    {study.results && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">
                          Results
                        </h3>
                        <p className="text-sm text-gray-600">{study.results}</p>
                      </div>
                    )}
                    {study.conclusion && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">
                          Conclusion
                        </h3>
                        <p className="text-sm text-gray-600">
                          {study.conclusion}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Links */}
                {study.doi && (
                  <div className="pt-6 border-t">
                    <h3 className="font-semibold text-gray-900 mb-3">
                      Study Links
                    </h3>
                    <div className="flex gap-4">
                      <a
                        href={`https://doi.org/${study.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-800"
                      >
                        <HiExternalLink className="w-4 h-4" />
                        View DOI
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default SimpleStudyPage;
