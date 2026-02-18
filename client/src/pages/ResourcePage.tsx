import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { HiArrowLeft, HiArrowRight, HiDownload, HiShare } from "react-icons/hi";
import NewsletterSection from "@/components/home/NewsletterSection";
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";

const ResourcePage = () => {
  const { slug } = useParams();

  const {
    data: resource,
    isLoading,
    error,
  } = useQuery({
    queryKey: [`/api/resources/${slug}`],
  });

  // Get all resources for related resources section
  const { data: allResources } = useQuery({
    queryKey: ["/api/resources"],
  });

  // Get related resources (exclude current)
  const relatedResources = allResources
    ? allResources.filter((r: any) => r.slug !== slug).slice(0, 2)
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="h-6 bg-neutral-200 rounded w-48 mb-6 animate-pulse"></div>
            <div className="h-10 bg-neutral-200 rounded w-full mb-4 animate-pulse"></div>
            <div className="h-64 bg-neutral-200 rounded w-full mb-6 animate-pulse"></div>
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

  if (error || !resource) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="container mx-auto px-4 text-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 pb-6">
              <h1 className="text-xl font-bold mb-4">Resource Not Found</h1>
              <p className="text-neutral-600 mb-6">
                {error instanceof Error
                  ? error.message
                  : "We couldn't find the resource you're looking for. It may have been removed or the URL is incorrect."}
              </p>
              <Link href="/resources">
                <Button>
                  <HiArrowLeft className="mr-2" />
                  Browse All Resources
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>{resource.title} | Hydrogen Studies Educational Resources</title>
        <meta name="description" content={resource.description} />
      </Helmet>

      <section className="bg-primary-gradient text-white py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center text-sm text-white/80 mb-6">
              <Link href="/">
                <a className="hover:text-white">Home</a>
              </Link>
              <span className="mx-2">/</span>
              <Link href="/resources">
                <a className="hover:text-white">Resources</a>
              </Link>
              <span className="mx-2">/</span>
              <span className="text-white">{resource.title}</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              {resource.title}
            </h1>
            <p className="text-xl text-white/90 max-w-3xl">
              {resource.description}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Feature image */}
            <div className="rounded-xl overflow-hidden shadow-md mb-8">
              <img
                src={resource.imageUrl}
                alt={resource.title}
                className="w-full h-auto"
              />
            </div>

            {/* Content */}
            <div className="prose prose-lg max-w-none mb-10">
              <p className="lead text-lg text-neutral-700">
                {resource.content}
              </p>

              {/* This is placeholder content since the actual resource content is limited in the data */}
              <h2>Understanding Molecular Hydrogen</h2>
              <p>
                Molecular hydrogen (H₂) is a colorless, odorless, non-toxic gas
                that, when used therapeutically, can potentially offer numerous
                health benefits. Its small molecular size allows it to diffuse
                easily through cell membranes, penetrating the blood-brain
                barrier and even accessing subcellular compartments.
              </p>

              <h2>Mechanisms of Action</h2>
              <p>
                The primary mechanisms through which hydrogen exerts its effects
                include:
              </p>
              <ul>
                <li>
                  <strong>Selective antioxidation</strong>: H₂ selectively
                  neutralizes cytotoxic oxygen radicals, particularly hydroxyl
                  radicals (•OH) and peroxynitrite (ONOO⁻), while preserving
                  beneficial reactive oxygen species involved in cell signaling.
                </li>
                <li>
                  <strong>Anti-inflammatory effects</strong>: H₂ can
                  downregulate pro-inflammatory cytokines and signaling
                  pathways.
                </li>
                <li>
                  <strong>Cell metabolism regulation</strong>: Evidence suggests
                  that H₂ may help regulate energy metabolism and mitochondrial
                  function.
                </li>
              </ul>

              <h2>Administration Methods</h2>
              <p>Hydrogen can be administered through several routes:</p>
              <ul>
                <li>Hydrogen-rich water (HRW)</li>
                <li>Inhalation of H₂ gas</li>
                <li>Hydrogen baths</li>
                <li>
                  Hydrogen saline solutions (primarily in research settings)
                </li>
              </ul>

              <h2>Safety Profile</h2>
              <p>
                One of the notable advantages of hydrogen therapy is its
                excellent safety profile. H₂ is naturally produced in small
                amounts by intestinal bacteria, and even at higher
                concentrations used therapeutically, it shows no significant
                adverse effects. It doesn't alter the pH balance of the body and
                is not flammable at therapeutic concentrations.
              </p>

              <Separator className="my-8" />

              <div className="bg-neutral-50 p-6 rounded-lg border border-neutral-200 not-prose">
                <h3 className="text-xl font-semibold mb-3">Key Takeaways</h3>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-primary mr-2">✓</span>
                    Molecular hydrogen acts as a selective antioxidant,
                    targeting harmful free radicals
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">✓</span>
                    Multiple administration methods make hydrogen therapy
                    versatile and accessible
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">✓</span>
                    Research has shown potential benefits across numerous health
                    conditions
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary mr-2">✓</span>
                    Hydrogen therapy has an excellent safety profile with
                    minimal risk of adverse effects
                  </li>
                </ul>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 mb-12">
              <Button className="bg-primary hover:bg-primary-dark text-white">
                <HiDownload className="mr-2" /> Download as PDF
              </Button>
              <Button
                variant="outline"
                className="border-primary text-primary hover:bg-primary/5"
              >
                <HiShare className="mr-2" /> Share Resource
              </Button>
            </div>

            {/* Related Resources */}
            {relatedResources.length > 0 && (
              <div className="mt-12 mb-8">
                <h2 className="text-2xl font-bold mb-6">Related Resources</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {relatedResources.map((relatedResource: any) => (
                    <Link
                      key={relatedResource.id}
                      href="/recommendations"
                    >
                      <a className="group">
                        <div className="bg-neutral-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition h-full">
                          <img
                            src={relatedResource.imageUrl}
                            alt={relatedResource.title}
                            className="w-full h-48 object-cover"
                          />
                          <div className="p-5">
                            <h3 className="text-xl font-semibold mb-2">
                              {relatedResource.title}
                            </h3>
                            <p className="text-neutral-600 mb-3">
                              {relatedResource.description}
                            </p>
                            <div className="text-primary font-medium flex items-center group-hover:translate-x-1 transition-transform">
                              Read Guide <HiArrowRight className="ml-2" />
                            </div>
                          </div>
                        </div>
                      </a>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-10">
              <Link href="/resources">
                <Button
                  variant="ghost"
                  className="text-neutral-600 hover:text-primary"
                >
                  <HiArrowLeft className="mr-2" /> Back to Resources
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <NewsletterSection />
    </>
  );
};

export default ResourcePage;
