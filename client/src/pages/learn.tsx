import React from "react";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import SiteHeader from "@/components/layout/SiteHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import { Link } from "wouter";

/**
 * Educational resources page component
 */
export default function LearnPage() {
  // Fetch all educational resources
  const { data: resources = [], isLoading: resourcesLoading } = useQuery({
    queryKey: ["/api/educational/resources"],
  });

  // Fetch glossary terms
  const { data: glossaryTerms = [], isLoading: glossaryLoading } = useQuery({
    queryKey: ["/api/educational/glossary"],
  });

  // Fetch FAQ items
  const { data: faqItems = [], isLoading: faqLoading } = useQuery({
    queryKey: ["/api/educational/faq"],
  });

  // Filter resources by type
  const tutorials = React.useMemo(
    () => resources.filter((resource) => resource.resourceType === "tutorial"),
    [resources],
  );

  const guides = React.useMemo(
    () => resources.filter((resource) => resource.resourceType === "guide"),
    [resources],
  );

  const videos = React.useMemo(
    () => resources.filter((resource) => resource.resourceType === "video"),
    [resources],
  );

  // Group glossary terms by first letter
  const groupedTerms = React.useMemo(() => {
    if (!glossaryTerms.length) return {};

    return glossaryTerms.reduce((acc, term) => {
      const firstLetter = term.term.charAt(0).toUpperCase();
      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      acc[firstLetter].push(term);
      return acc;
    }, {});
  }, [glossaryTerms]);

  // Sorted letters for glossary navigation
  const letters = React.useMemo(
    () => Object.keys(groupedTerms).sort(),
    [groupedTerms],
  );

  // Group FAQ items by category
  const groupedFaqs = React.useMemo(() => {
    if (!faqItems.length) return {};

    return faqItems.reduce((acc, faq) => {
      if (!acc[faq.category]) {
        acc[faq.category] = [];
      }
      acc[faq.category].push(faq);
      return acc;
    }, {});
  }, [faqItems]);

  // Sorted FAQ categories
  const faqCategories = React.useMemo(
    () => Object.keys(groupedFaqs).sort(),
    [groupedFaqs],
  );

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>
          Hydrogen Therapy Education | Tutorials, Glossary & Expert Resources
        </title>
        <meta
          name="description"
          content="Learn about molecular hydrogen therapy with expert educational resources. Access tutorials, comprehensive glossary terms, and answers to frequently asked questions about hydrogen research."
        />
        <meta
          name="keywords"
          content="hydrogen therapy education, molecular hydrogen tutorials, h2 therapy glossary, hydrogen water guide, hydrogen gas FAQ, molecular hydrogen learning resources"
        />
        <link rel="canonical" href="https://hydrogenstudies.com/learn" />

        {/* Open Graph Tags */}
        <meta
          property="og:title"
          content="Hydrogen Therapy Educational Resources | Learn About H2 Benefits"
        />
        <meta
          property="og:description"
          content="Comprehensive educational materials about molecular hydrogen therapy. Expert guides, video tutorials, and scientific explanations for researchers and health enthusiasts."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/learn" />
        <meta property="og:image" content="/og-education-image.jpg" />

        {/* Twitter Card Tags */}
        <meta
          name="twitter:title"
          content="Hydrogen Therapy Learning Center | Educational Resources"
        />
        <meta
          name="twitter:description"
          content="Learn about molecular hydrogen therapy benefits with expert tutorials, comprehensive glossary, and frequently asked questions about hydrogen research."
        />

        {/* Schema.org structured data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LearningResource",
            name: "Hydrogen Therapy Educational Resources",
            description:
              "Comprehensive educational materials about molecular hydrogen therapy and its health applications",
            url: "https://hydrogenstudies.com/learn",
            educationalLevel: "Beginner to Advanced",
            keywords:
              "hydrogen therapy, molecular hydrogen, h2 therapy, hydrogen water, medical education",
            hasPart: [
              {
                "@type": "Course",
                name: "Hydrogen Therapy Tutorials",
                description:
                  "Step-by-step guides for beginners to understand molecular hydrogen applications",
              },
              {
                "@type": "DefinedTermSet",
                name: "Molecular Hydrogen Glossary",
                description:
                  "Comprehensive glossary of terminology related to hydrogen therapy research",
              },
              {
                "@type": "FAQPage",
                mainEntity: faqItems.slice(0, 5).map((faq) => ({
                  "@type": "Question",
                  name: faq.question,
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: faq.answer.replace(/<[^>]*>?/gm, ""),
                  },
                })),
              },
            ],
            provider: {
              "@type": "Organization",
              name: "Hydrogen Studies",
              url: "https://hydrogenstudies.com",
            },
          })}
        </script>
      </Helmet>

      <div className="py-8 md:py-12 bg-gradient-to-br from-blue-50 to-indigo-50">
        <ResponsiveContainer className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 mb-4">
            Educational Resources
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Explore our comprehensive educational materials to enhance your
            understanding of hydrogen research and its applications in health
            and medicine.
          </p>
        </ResponsiveContainer>
      </div>

      <ResponsiveContainer className="py-8">
        <Tabs defaultValue="resources" className="w-full">
          <TabsList className="mb-8 w-full justify-start border-b pb-0">
            <TabsTrigger value="resources" className="text-base">
              Resources
            </TabsTrigger>
            <TabsTrigger value="glossary" className="text-base">
              Glossary
            </TabsTrigger>
            <TabsTrigger value="faq" className="text-base">
              FAQ
            </TabsTrigger>
          </TabsList>

          {/* Resources Tab */}
          <TabsContent value="resources" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Tutorials Section */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
                <div className="bg-blue-50 p-4 border-b border-gray-100">
                  <h3 className="text-xl font-semibold text-blue-700">
                    Tutorials
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">
                    Step-by-step guides for beginners
                  </p>
                </div>
                <div className="p-4">
                  {resourcesLoading ? (
                    <div className="animate-pulse space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-gray-100 rounded"></div>
                      ))}
                    </div>
                  ) : tutorials.length > 0 ? (
                    <ul className="space-y-3">
                      {tutorials.map((tutorial) => (
                        <li
                          key={tutorial.id}
                          className="border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                        >
                          <Link
                            to={`/resources/${tutorial.id}`}
                            className="block hover:bg-blue-50 p-2 rounded-md transition-colors"
                          >
                            <h4 className="font-medium text-blue-800">
                              {tutorial.title}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                              {tutorial.description}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">
                      No tutorials available yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Guides Section */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
                <div className="bg-indigo-50 p-4 border-b border-gray-100">
                  <h3 className="text-xl font-semibold text-indigo-700">
                    Guides
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">
                    In-depth explanations on key topics
                  </p>
                </div>
                <div className="p-4">
                  {/* Featured Guide - Always visible */}
                  <div className="mb-6 border-2 border-indigo-100 rounded-lg p-4 bg-indigo-50/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs px-3 py-1 rounded-bl-lg">
                      Featured
                    </div>
                    <h4 className="font-semibold text-indigo-800 text-lg">
                      Complete Guide to Molecular Hydrogen Therapy
                    </h4>
                    <p className="text-sm text-gray-700 mt-1 mb-3">
                      Comprehensive overview of hydrogen therapy mechanisms,
                      delivery methods, and potential health benefits based on
                      current research.
                    </p>
                    <Link
                      to="/educational/hydrogen-therapy-guide"
                      className="inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Read the guide
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 ml-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </Link>
                  </div>

                  {/* Dynamic Guides from API */}
                  {resourcesLoading ? (
                    <div className="animate-pulse space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-gray-100 rounded"></div>
                      ))}
                    </div>
                  ) : guides.length > 0 ? (
                    <ul className="space-y-3">
                      {guides.map((guide) => (
                        <li
                          key={guide.id}
                          className="border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                        >
                          <Link
                            to={`/resources/${guide.id}`}
                            className="block hover:bg-indigo-50 p-2 rounded-md transition-colors"
                          >
                            <h4 className="font-medium text-indigo-800">
                              {guide.title}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                              {guide.description}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">
                      Additional guides coming soon.
                    </p>
                  )}
                </div>
              </div>

              {/* Videos Section */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100">
                <div className="bg-purple-50 p-4 border-b border-gray-100">
                  <h3 className="text-xl font-semibold text-purple-700">
                    Videos
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">
                    Visual explanations and demonstrations
                  </p>
                </div>
                <div className="p-4">
                  {resourcesLoading ? (
                    <div className="animate-pulse space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-gray-100 rounded"></div>
                      ))}
                    </div>
                  ) : videos.length > 0 ? (
                    <ul className="space-y-3">
                      {videos.map((video) => (
                        <li
                          key={video.id}
                          className="border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                        >
                          <Link
                            to={`/resources/${video.id}`}
                            className="block hover:bg-purple-50 p-2 rounded-md transition-colors"
                          >
                            <h4 className="font-medium text-purple-800">
                              {video.title}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                              {video.description}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">
                      No videos available yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Glossary Tab */}
          <TabsContent value="glossary" className="mt-6">
            {glossaryLoading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 bg-gray-100 rounded"></div>
                ))}
              </div>
            ) : glossaryTerms.length > 0 ? (
              <div className="space-y-8">
                {/* Alphabet navigation */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {letters.map((letter) => (
                    <a
                      key={letter}
                      href={`#glossary-${letter}`}
                      className="w-8 h-8 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-800 rounded font-medium transition-colors"
                    >
                      {letter}
                    </a>
                  ))}
                </div>

                {/* Terms by letter */}
                {letters.map((letter) => (
                  <div
                    key={letter}
                    id={`glossary-${letter}`}
                    className="scroll-mt-20"
                  >
                    <h3 className="text-2xl font-bold text-blue-800 border-b border-gray-200 pb-2 mb-4">
                      {letter}
                    </h3>
                    <dl className="space-y-6">
                      {groupedTerms[letter].map((term) => (
                        <div
                          key={term.id}
                          className="bg-white p-4 rounded-lg shadow-sm border border-gray-100"
                        >
                          <dt className="text-lg font-semibold text-gray-900">
                            {term.term}
                          </dt>
                          <dd className="mt-2 text-gray-700">
                            {term.definition}
                          </dd>
                          {term.relatedTerms && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <span className="text-sm font-medium text-gray-600">
                                Related terms:{" "}
                              </span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {term.relatedTerms
                                  .split(",")
                                  .map((related, index) => (
                                    <span
                                      key={index}
                                      className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                                    >
                                      {related.trim()}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  No glossary terms available yet.
                </p>
              </div>
            )}
          </TabsContent>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="mt-6">
            {faqLoading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-100 rounded"></div>
                ))}
              </div>
            ) : faqItems.length > 0 ? (
              <div className="space-y-8">
                {faqCategories.map((category) => (
                  <div
                    key={category}
                    className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100"
                  >
                    <h3 className="text-xl font-semibold p-4 bg-indigo-50 text-indigo-800 border-b border-gray-100">
                      {category}
                    </h3>
                    <Accordion type="single" collapsible className="p-4">
                      {groupedFaqs[category]
                        .sort((a, b) => a.order - b.order)
                        .map((faq) => (
                          <AccordionItem key={faq.id} value={`faq-${faq.id}`}>
                            <AccordionTrigger className="text-left font-medium text-gray-800 hover:text-indigo-700">
                              {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-gray-700">
                              <div
                                dangerouslySetInnerHTML={{ __html: faq.answer }}
                              />
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                    </Accordion>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  No FAQ items available yet.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </ResponsiveContainer>
    </>
  );
}
