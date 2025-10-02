import { useEffect } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Book,
  BookOpenText,
  FileText,
  HelpCircle,
  Lightbulb,
} from "lucide-react";
import {
  ResponsiveContainer,
  ResponsiveGrid,
} from "@/components/layout/ResponsiveContainer";
import { getResponsiveFontSize } from "@/lib/responsive";

export default function LearnPage() {
  // Fetch all educational resources
  const { data: resources, isLoading } = useQuery({
    queryKey: ["/api/educational-resources"],
  });

  // Fetch glossary terms
  const { data: glossaryTerms } = useQuery({
    queryKey: ["/api/glossary"],
  });

  // Fetch FAQs
  const { data: faqItems } = useQuery({
    queryKey: ["/api/faqs"],
  });

  useEffect(() => {
    // Scroll to top on page load
    window.scrollTo(0, 0);
  }, []);

  return (
    <ResponsiveContainer>
      <Helmet>
        <title>Learn About Hydrogen Research | HydrogenStudies.com</title>
        <meta
          name="description"
          content="Educational resources to help you understand hydrogen therapy research, including glossary of terms, FAQ, and tutorials on how to read scientific studies."
        />
      </Helmet>

      <div className="py-6 md:py-10">
        <h1
          className={`${getResponsiveFontSize("heading1")} text-center text-gradient-primary mb-4`}
        >
          Learn About Hydrogen Research
        </h1>

        <p className="text-lg text-center text-muted-foreground max-w-3xl mx-auto mb-8">
          Resources to help you understand hydrogen therapy research, the
          science behind it, and how to interpret scientific studies.
        </p>

        <Separator className="my-6" />

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full max-w-xl mx-auto grid grid-cols-3 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="glossary">Glossary</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* How to Read Research Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <BookOpenText className="h-8 w-8 mb-2 text-primary" />
                  <CardTitle>How to Read Research</CardTitle>
                  <CardDescription>
                    Understand how to interpret scientific studies on hydrogen
                    therapy
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">
                    Learn how to navigate scientific papers, understand key
                    sections, and evaluate the quality of research.
                  </p>
                  <Button asChild className="w-full">
                    <Link to="/learn/how-to-read-research">Read Guide</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Glossary Terms Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Book className="h-8 w-8 mb-2 text-primary" />
                  <CardTitle>Glossary of Terms</CardTitle>
                  <CardDescription>
                    Definitions of common scientific terms found in hydrogen
                    research
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">
                    From "oxidative stress" to "molecular hydrogen" — understand
                    the key terminology used in studies.
                  </p>
                  <Button asChild className="w-full">
                    <Link to="/learn/glossary">Browse Glossary</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Frequently Asked Questions Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <HelpCircle className="h-8 w-8 mb-2 text-primary" />
                  <CardTitle>Frequently Asked Questions</CardTitle>
                  <CardDescription>
                    Common questions about hydrogen therapy research
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">
                    Get answers to common questions about hydrogen therapy, its
                    effects, and the current state of research.
                  </p>
                  <Button asChild className="w-full">
                    <Link to="/learn/faq">View FAQ</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Featured Tutorials */}
            <div className="mt-12">
              <h2 className={`${getResponsiveFontSize("heading2")} mb-6`}>
                Featured Tutorials
              </h2>
              <ResponsiveGrid
                mobileColumns={1}
                tabletColumns={2}
                desktopColumns={3}
                gap="medium"
              >
                {isLoading ? (
                  <p>Loading tutorials...</p>
                ) : (
                  resources
                    ?.filter(
                      (resource) =>
                        resource.resourceType === "tutorial" &&
                        resource.isPublished,
                    )
                    .slice(0, 3)
                    .map((tutorial) => (
                      <Card
                        key={tutorial.id}
                        className="hover:shadow-lg transition-shadow"
                      >
                        <CardHeader>
                          <Lightbulb className="h-6 w-6 mb-2 text-primary" />
                          <CardTitle>{tutorial.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="line-clamp-3 mb-4">
                            {tutorial.content.substring(0, 100)}...
                          </p>
                          <Button asChild variant="outline" className="w-full">
                            <Link to={`/learn/tutorials/${tutorial.slug}`}>
                              Read Tutorial
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    ))
                )}
              </ResponsiveGrid>

              <div className="flex justify-center mt-8">
                <Button asChild>
                  <Link to="/learn/tutorials">View All Tutorials</Link>
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Glossary Tab */}
          <TabsContent value="glossary">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Book className="h-6 w-6 mr-2" />
                  Glossary of Scientific Terms
                </CardTitle>
                <CardDescription>
                  Commonly used terminology in hydrogen therapy research
                </CardDescription>
              </CardHeader>
              <CardContent>
                {glossaryTerms ? (
                  <div className="space-y-4">
                    {/* Alphabet navigation */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {Array.from({ length: 26 }, (_, i) =>
                        String.fromCharCode(65 + i),
                      ).map((letter) => (
                        <Button
                          key={letter}
                          variant="outline"
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => {
                            const element = document.getElementById(
                              `glossary-${letter}`,
                            );
                            if (element)
                              element.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          {letter}
                        </Button>
                      ))}
                    </div>

                    {/* Group terms by first letter */}
                    {glossaryTerms.length > 0 ? (
                      Object.entries(
                        glossaryTerms.reduce((acc, term) => {
                          const firstLetter = term.term.charAt(0).toUpperCase();
                          if (!acc[firstLetter]) acc[firstLetter] = [];
                          acc[firstLetter].push(term);
                          return acc;
                        }, {}),
                      )
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([letter, terms]) => (
                          <div key={letter} id={`glossary-${letter}`}>
                            <h3 className="text-2xl font-bold mb-3">
                              {letter}
                            </h3>
                            <div className="space-y-4 mb-8">
                              {terms.map((term) => (
                                <div key={term.id} className="pb-3 border-b">
                                  <h4 className="font-semibold text-lg">
                                    {term.term}
                                  </h4>
                                  <p>{term.definition}</p>
                                  {term.relatedTerms &&
                                    term.relatedTerms.length > 0 && (
                                      <div className="mt-2 text-sm text-muted-foreground">
                                        <span className="font-medium">
                                          Related:{" "}
                                        </span>
                                        {term.relatedTerms.map(
                                          (related, index) => (
                                            <span key={related}>
                                              {related}
                                              {index <
                                              term.relatedTerms.length - 1
                                                ? ", "
                                                : ""}
                                            </span>
                                          ),
                                        )}
                                      </div>
                                    )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                    ) : (
                      <p>No glossary terms found.</p>
                    )}
                  </div>
                ) : (
                  <p>Loading glossary...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* FAQ Tab */}
          <TabsContent value="faq">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <HelpCircle className="h-6 w-6 mr-2" />
                  Frequently Asked Questions
                </CardTitle>
                <CardDescription>
                  Common questions about hydrogen therapy and research
                </CardDescription>
              </CardHeader>
              <CardContent>
                {faqItems ? (
                  <div className="space-y-6">
                    {/* Group FAQs by category */}
                    {faqItems.length > 0 ? (
                      Object.entries(
                        faqItems.reduce((acc, faq) => {
                          if (!acc[faq.category]) acc[faq.category] = [];
                          acc[faq.category].push(faq);
                          return acc;
                        }, {}),
                      ).map(([category, items]) => (
                        <div key={category} className="mb-8">
                          <h3 className="text-xl font-bold mb-4 capitalize">
                            {category} Questions
                          </h3>
                          <div className="space-y-4">
                            {items
                              .sort((a, b) => a.displayOrder - b.displayOrder)
                              .map((faq) => (
                                <div key={faq.id} className="pb-4 border-b">
                                  <h4 className="font-semibold text-lg mb-2">
                                    {faq.question}
                                  </h4>
                                  <p>{faq.answer}</p>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p>No FAQ items found.</p>
                    )}
                  </div>
                ) : (
                  <p>Loading FAQs...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ResponsiveContainer>
  );
}
