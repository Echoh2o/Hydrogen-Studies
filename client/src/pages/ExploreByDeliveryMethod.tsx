import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Helmet } from "react-helmet";

// Icons for delivery methods
import {
  Droplet,
  Wind,
  Bath,
  Beaker,
  Pill,
  Stethoscope,
  Soup,
} from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";

const getDeliveryMethodIcon = (slug: string, className: string = "") => {
  switch (slug) {
    case "drinking-water":
      return <Droplet className={className} />;
    case "inhalation":
      return <Wind className={className} />;
    case "bathing":
      return <Bath className={className} />;
    case "saline-injection":
      return <Stethoscope className={className} />;
    case "tablets":
      return <Pill className={className} />;
    case "infused-liquids":
      return <Soup className={className} />;
    case "echoh-flask":
      return <Beaker className={className} />;
    default:
      return <Droplet className={className} />;
  }
};

/** Group card for the three primary delivery method categories */
const DeliveryMethodGroup: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  bgClass: string;
  methods: any[];
}> = ({ title, description, icon, bgClass, methods }) => {
  const totalStudies = methods.reduce((sum: number, m: any) => sum + (m.studyCount || 0), 0);

  return (
    <Card className={`overflow-hidden bg-gradient-to-br ${bgClass} border-0`}>
      <CardHeader className="p-6 pb-3">
        <div className="flex items-center gap-3 mb-2">
          {icon}
          <CardTitle className="text-2xl">{title}</CardTitle>
        </div>
        <Badge variant="secondary" className="w-fit">
          {totalStudies} studies
        </Badge>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        <p className="text-muted-foreground text-sm mb-4">{description}</p>
        <div className="space-y-2">
          {methods.map((method: any) => (
            <Link key={method.id} href={`/explore-by-delivery-method/${method.slug}`}>
              <div className="flex items-center justify-between p-2 rounded-md hover:bg-white/60 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  {getDeliveryMethodIcon(method.slug, "h-4 w-4")}
                  <span className="text-sm font-medium">{method.name}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {method.studyCount}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const ExploreByDeliveryMethodPage: React.FC = () => {
  // Fetch all delivery methods
  const { data: deliveryMethods, isLoading: deliveryMethodsLoading } = useQuery<any>(
    {
      queryKey: ["/api/delivery-methods"],
    },
  );

  return (
    <>
      <SiteHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <PageBreadcrumb items={[
          { label: "Home", href: "/" },
          { label: "Studies", href: "/studies" },
          { label: "By Delivery Method" },
        ]} />
      </div>
      <div className="container mx-auto py-10">
        <Helmet>
          <title>
            Explore Hydrogen Studies by Delivery Method | HydrogenStudies.com
          </title>
          <meta
            name="description"
            content="Discover hydrogen research organized by delivery methods including drinking water, inhalation, bathing, tablets, and injections."
          />
          <meta property="og:title" content="Explore Hydrogen Studies by Delivery Method | HydrogenStudies.com" />
          <meta property="og:description" content="Discover hydrogen research organized by delivery methods including drinking water, inhalation, bathing, tablets, and injections." />
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://hydrogenstudies.com/explore-by-delivery-method" />
          <meta name="twitter:card" content="summary" />
          <link rel="canonical" href="https://hydrogenstudies.com/explore-by-delivery-method" />
        </Helmet>

        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">
              Explore by Delivery Method
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Find hydrogen research studies organized by how hydrogen is
              administered
            </p>
          </div>

          {deliveryMethodsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {Array(3)
                .fill(0)
                .map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardHeader className="p-6">
                      <Skeleton className="h-8 w-3/4" />
                    </CardHeader>
                    <CardContent className="p-6 pt-2">
                      <Skeleton className="h-32" />
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <>
              {/* Three primary delivery method groups */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Group 1: Hydrogen Water (Drinking) */}
                <DeliveryMethodGroup
                  title="Hydrogen Water"
                  description="The most accessible way to consume molecular hydrogen — through hydrogen-enriched drinking water."
                  icon={<Droplet className="h-8 w-8 text-blue-600" />}
                  bgClass="from-blue-50 to-blue-100"
                  methods={(deliveryMethods || []).filter((m: any) =>
                    ["drinking-water", "infused-liquids", "echoh-flask"].includes(m.slug)
                  )}
                />

                {/* Group 2: Hydrogen Gas Inhalation */}
                <DeliveryMethodGroup
                  title="Hydrogen Inhalation"
                  description="Therapeutic hydrogen gas administered through nasal cannula or mask, studied in clinical settings."
                  icon={<Wind className="h-8 w-8 text-teal-600" />}
                  bgClass="from-teal-50 to-teal-100"
                  methods={(deliveryMethods || []).filter((m: any) =>
                    ["inhalation"].includes(m.slug)
                  )}
                />

                {/* Group 3: Other Methods */}
                <DeliveryMethodGroup
                  title="Other Methods"
                  description="Bathing, saline injection, and tablet forms of hydrogen delivery used in research."
                  icon={<Bath className="h-8 w-8 text-purple-600" />}
                  bgClass="from-purple-50 to-purple-100"
                  methods={(deliveryMethods || []).filter((m: any) =>
                    ["bathing", "saline-injection", "tablets"].includes(m.slug)
                  )}
                />
              </div>

              {/* Full list below for discovery */}
              <div className="mt-12">
                <h2 className="text-2xl font-semibold mb-6">All Delivery Methods</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {deliveryMethods?.map((method: any) => (
                    <Link key={method.id} href={`/explore-by-delivery-method/${method.slug}`}>
                      <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
                        <CardHeader className="p-4 pb-2 flex flex-row items-start space-x-4">
                          <div className="bg-primary/10 p-2 rounded-md">
                            {getDeliveryMethodIcon(
                              method.slug,
                              "h-6 w-6 text-primary",
                            )}
                          </div>
                          <div>
                            <CardTitle className="text-xl">{method.name}</CardTitle>
                            <Badge variant="outline" className="mt-1">
                              {method.studyCount} studies
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                          <CardDescription className="line-clamp-3 text-sm">
                            {method.description}
                          </CardDescription>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Echo Flask promotion */}
          <div className="bg-gradient-to-r from-teal-50 to-teal-100 p-6 rounded-lg mt-12">
            <div className="flex flex-col md:flex-row items-center">
              <div className="mb-4 md:mb-0 md:mr-6">
                <Beaker className="h-16 w-16 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2">
                  Echo Flask - The Optimal Hydrogen Delivery System
                </h3>
                <p className="text-muted-foreground mb-4">
                  Echo Flask delivers optimal hydrogen-enriched water backed by
                  scientific research. Learn why our delivery method is
                  preferred by researchers.
                </p>
                <div>
                  <Button asChild>
                    <a
                      href="https://echowater.com/products/echo-flask"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Learn More
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ExploreByDeliveryMethodPage;

// Detail page for a specific delivery method
export const DeliveryMethodDetailPage: React.FC = () => {
  const [, params] = useRoute("/explore-by-delivery-method/:method");
  const slug = params?.method || "";

  // Fetch delivery method details
  const { data: methodData, isLoading: methodLoading } = useQuery<any>({
    queryKey: [`/api/delivery-methods/${slug}`],
    enabled: !!slug,
  });

  // Fetch studies for this delivery method
  const { data: studiesData, isLoading: studiesLoading } = useQuery<any>({
    queryKey: [`/api/delivery-methods/${slug}/studies`],
    enabled: !!slug,
  });

  const method = methodData;
  const studies = studiesData?.studies || [];

  const isLoading = methodLoading || studiesLoading;

  // Special Echo Flask content
  const isEchoFlask = slug === "echoh-flask";

  return (
    <div className="container mx-auto py-10">
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-10 w-3/4 max-w-md" />
          <Skeleton className="h-20 w-full max-w-2xl" />
          <div className="grid grid-cols-1 gap-4">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
          </div>
        </div>
      ) : (
        <>
          <Helmet>
            <title>
              {method?.name} | Hydrogen Research | HydrogenStudies.com
            </title>
            <meta
              name="description"
              content={`Explore hydrogen research studies using ${method?.name.toLowerCase()} - ${method?.description}`}
            />
          </Helmet>

          <div className="mb-8 flex items-center space-x-4">
            <div className="bg-primary/10 p-3 rounded-md">
              {getDeliveryMethodIcon(method?.slug, "h-8 w-8 text-primary")}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{method?.name}</h1>
              <p className="text-muted-foreground">{method?.description}</p>
            </div>
          </div>

          {isEchoFlask && (
            <div className="bg-gradient-to-r from-teal-50 to-teal-100 p-6 rounded-lg mb-8">
              <div className="flex flex-col md:flex-row items-center">
                <div className="mb-4 md:mb-0 md:mr-6">
                  <Beaker className="h-16 w-16 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">
                    Echo Flask - The Gold Standard in Hydrogen Water
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Echo Flask delivers the highest concentration of molecular
                    hydrogen in a convenient, portable form, backed by
                    scientific research. Our patented technology ensures optimal
                    hydrogen delivery for maximum health benefits.
                  </p>
                  <div>
                    <Button asChild>
                      <a
                        href="https://echowater.com/products/echo-flask"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Shop Echo Flask
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-4">
              Research using {method?.name}
            </h2>

            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="all">
                  All Studies ({studies.length})
                </TabsTrigger>
                <TabsTrigger value="clinical">
                  Clinical Studies (
                  {studies.filter((s: any) => s.studyType === "human").length})
                </TabsTrigger>
                <TabsTrigger value="preclinical">
                  Preclinical (
                  {
                    studies.filter(
                      (s: any) =>
                        s.studyType === "animal" || s.studyType === "in vitro",
                    ).length
                  }
                  )
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all">
                <div className="space-y-4">
                  {studies.length > 0 ? (
                    studies.map((study: any) => (
                      <StudyCard key={study.id} study={study} />
                    ))
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-muted-foreground">
                        No studies found for this delivery method.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="clinical">
                <div className="space-y-4">
                  {studies.filter((s: any) => s.studyType === "human").length >
                  0 ? (
                    studies
                      .filter((s: any) => s.studyType === "human")
                      .map((study: any) => (
                        <StudyCard key={study.id} study={study} />
                      ))
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-muted-foreground">
                        No clinical studies found for this delivery method.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="preclinical">
                <div className="space-y-4">
                  {studies.filter(
                    (s: any) =>
                      s.studyType === "animal" || s.studyType === "in vitro",
                  ).length > 0 ? (
                    studies
                      .filter(
                        (s: any) =>
                          s.studyType === "animal" ||
                          s.studyType === "in vitro",
                      )
                      .map((study: any) => (
                        <StudyCard key={study.id} study={study} />
                      ))
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-muted-foreground">
                        No preclinical studies found for this delivery method.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}
    </div>
  );
};

// Study card component for displaying study info
const StudyCard: React.FC<{ study: any }> = ({ study }) => {
  return (
    <Link href={study.slug ? `/study/${study.slug}` : `/study/id/${study.id}`}>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex justify-between">
            <CardTitle className="text-lg font-medium">{study.title}</CardTitle>
            {study.peerReviewed && (
              <Badge className="ml-2" variant="secondary">
                Peer Reviewed
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>{new Date(study.publishDate).getFullYear()}</span>
            <span>•</span>
            <span>{study.journal}</span>
            {study.studyType && (
              <>
                <span>•</span>
                <span className="capitalize">{study.studyType} Study</span>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm line-clamp-2">{study.abstract}</p>

          <div className="mt-4 flex justify-between items-center">
            <div className="flex space-x-2">
              {study.doi && <Badge variant="outline">DOI: {study.doi}</Badge>}
            </div>
            <Button variant="ghost" size="sm">
              View Study
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
