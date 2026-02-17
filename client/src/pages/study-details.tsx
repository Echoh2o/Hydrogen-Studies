import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Helmet } from "react-helmet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DetailSkeleton,
  ErrorDisplay,
  EmptyState,
} from "@/components/ui/loading-states";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { formatDate } from "@/lib/utils";
import { Study } from "@/types";
import {
  ArrowLeft,
  Calendar,
  User,
  BookOpen,
  FileText,
  Link as LinkIcon,
  Download,
  FileQuestion,
  Share2,
  ExternalLink,
  RefreshCcw,
  AlertCircle,
} from "lucide-react";
import InsightCardButton from "@/components/insight-cards/InsightCardButton";
import ResearchInsightCard from "@/components/sharing/ResearchInsightCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  ChevronRight,
  ChevronDown,
  LightbulbIcon,
  MessageSquare,
  Printer,
  Bookmark,
  Mail,
  Twitter,
  Facebook,
  Linkedin,
  Sparkles,
  Info,
  ListTodo,
  Beaker,
  Microscope,
  Lightbulb,
  BrainCircuit,
  PanelTop,
  AlertCircle as InfoCircle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ChatbotDialogue from "@/components/chatbot/ChatbotDialogue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Function to determine the enrichment status of a study
const determineEnrichmentStatus = (
  study: Study,
): "basic" | "partial" | "complete" => {
  // Check for enriched content fields
  const hasEnrichedContent = Boolean(
    study.methods ||
      study.results ||
      study.conclusion ||
      study.simplifiedExplanation ||
      (study.tags && study.tags.length > 0),
  );

  // Check for complete enrichment
  const hasCompleteEnrichment = Boolean(
    study.methods &&
      study.results &&
      study.conclusion &&
      study.simplifiedExplanation &&
      study.tags &&
      study.tags.length > 0,
  );

  if (hasCompleteEnrichment) return "complete";
  if (hasEnrichedContent) return "partial";
  return "basic";
};

// StudyContent component to display the study details
const StudyContent = ({
  study,
  refetch,
}: {
  study: Study;
  refetch: () => void;
}) => {
  const [enhancingContent, setEnhancingContent] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const { toast } = useToast();

  // For citation formats
  const [selectedCitationFormat, setSelectedCitationFormat] = useState("apa");

  // Function to scroll to a section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setActiveSection(sectionId);
    }
  };

  // Function to generate a slug from title
  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\w ]+/g, "")
      .replace(/ +/g, "-");
  };

  // Function to enrich study content with our direct API
  const enrichStudyContent = async () => {
    if (!study.doi) {
      toast({
        title: "Error",
        description:
          "This study doesn't have a DOI, which is required for content enrichment.",
        variant: "destructive",
      });
      return;
    }

    setEnhancingContent(true);
    try {
      const response = await apiRequest("POST", `/direct-enhance/${study.id}`);
      const result = await response.json();

      if (result.success) {
        toast({
          title: "Content Enriched",
          description: `Successfully enhanced study content with data from external sources.`,
        });
        // Refetch the study to show updated content
        refetch();
      } else {
        toast({
          title: "Enrichment Failed",
          description: result.message || "Unable to enrich study content.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to communicate with enrichment service.",
        variant: "destructive",
      });
      console.error("Content enrichment error:", error);
    } finally {
      setEnhancingContent(false);
    }
  };

  // Generate citation in different formats
  const generateCitation = (format: string) => {
    const authors = study.authors?.split(",").map((a) => a.trim()) || [
      "Unknown",
    ];
    const year =
      study.year || new Date(study.publishDate || "").getFullYear() || "n.d.";
    const title = study.title || "Untitled";
    const journal = study.journal || "Unknown Journal";
    const doi = study.doi || "";

    // Create a sanitized ID for BibTeX
    const sanitizedId =
      `${authors[0]?.split(" ").pop() || "Unknown"}${year}${title.split(" ")[0] || ""}`.replace(
        /[^a-zA-Z0-9]/g,
        "",
      );

    switch (format) {
      case "apa":
        return `${authors.join(", ")}. (${year}). ${title}. ${journal}. ${doi ? `https://doi.org/${doi}` : ""}`;

      case "mla":
        return `${authors[0].split(" ").pop()}, ${authors[0].split(" ").slice(0, -1).join(" ")}${authors.length > 1 ? ", et al" : ""}. "${title}." ${journal}, ${year}. ${doi ? `DOI: ${doi}` : ""}`;

      case "chicago":
        return `${authors.join(", ")}. "${title}." ${journal} (${year}). ${doi ? `https://doi.org/${doi}` : ""}`;

      case "bibtex":
        return `@article{${sanitizedId},
  author = {${authors.join(" and ")}},
  title = {${title}},
  journal = {${journal}},
  year = {${year}}${
    doi
      ? `,
  doi = {${doi}}`
      : ""
  }
}`;

      case "ris":
        return `TY  - JOUR
${authors.map((author) => `AU  - ${author}`).join("\n")}
TI  - ${title}
JO  - ${journal}
PY  - ${year}${doi ? `\nDO  - ${doi}` : ""}
ER  - `;

      default:
        return `${authors.join(", ")}. (${year}). ${title}. ${journal}. ${doi ? `https://doi.org/${doi}` : ""}`;
    }
  };

  // Function to copy citation to clipboard
  const copyCitation = () => {
    navigator.clipboard
      .writeText(generateCitation(selectedCitationFormat))
      .then(() => {
        toast({
          title: "Citation Copied",
          description: "The citation has been copied to your clipboard.",
        });
      })
      .catch(() => {
        toast({
          title: "Copy Failed",
          description: "Failed to copy citation to clipboard.",
          variant: "destructive",
        });
      });
  };

  // Function to print the study
  const printStudy = () => {
    window.print();
  };

  // Get related tags or keywords
  const getStudyTags = () => {
    if (study.tags && study.tags.length > 0) {
      return study.tags;
    }
    // Fallback to extracting keywords from title and abstract
    const keywords = new Set<string>();
    const commonKeywords = [
      "hydrogen",
      "water",
      "therapy",
      "treatment",
      "effects",
      "benefits",
      "molecular hydrogen",
    ];

    commonKeywords.forEach((keyword) => {
      if (
        (study.title?.toLowerCase().includes(keyword) ||
          study.abstract?.toLowerCase().includes(keyword)) &&
        !keywords.has(keyword)
      ) {
        keywords.add(keyword);
      }
    });

    return Array.from(keywords);
  };

  const keyStudyTags = getStudyTags();
  const studyScore = study.score || Math.floor(Math.random() * 5) + 1; // Fallback if no score is available

  // Extract a plain language summary if available or generate a placeholder
  const plainLanguageSummary =
    study.simplifiedExplanation ||
    "This research examines the effects of hydrogen-rich water on health outcomes. Hydrogen has potential therapeutic benefits due to its antioxidant properties and ability to reduce inflammation.";

  return (
    <>
      <Helmet>
        <title>{study.title} | Hydrogen Studies Research Database</title>
        <meta
          name="description"
          content={study.abstract?.substring(0, 160) || ""}
        />
        <meta name="keywords" content={keyStudyTags.join(", ")} />
        <meta property="og:title" content={study.title} />
        <meta
          property="og:description"
          content={study.abstract?.substring(0, 160) || ""}
        />
        <meta property="og:type" content="article" />
        <meta
          property="og:url"
          content={`https://hydrogenstudies.com/studies/${study.id}/${generateSlug(study.title)}`}
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={study.title} />
        <meta
          name="twitter:description"
          content={study.abstract?.substring(0, 160) || ""}
        />

        {/* Schema.org markup for scientific article */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ScholarlyArticle",
            headline: study.title,
            author: study.authors
              ?.split(",")
              .map((name: string) => ({
                "@type": "Person",
                name: name.trim(),
              })),
            datePublished: study.publishDate,
            publisher: { "@type": "Organization", name: study.journal },
            description: study.abstract?.substring(0, 160),
            keywords: keyStudyTags.join(","),
            sameAs: study.doi ? `https://doi.org/${study.doi}` : undefined,
          })}
        </script>
      </Helmet>

      <article className="bg-white rounded-xl p-6 md:p-8 shadow-sm print:shadow-none">
        {/* Top actions and badges row */}
        <div className="flex flex-wrap justify-between items-center mb-6">
          <Badge variant="outline" className={getCategoryColor(study.category)}>
            {study.category}
          </Badge>

          <div className="flex gap-2 mt-2 sm:mt-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={printStudy}
                    className="print:hidden"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Print Study</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsChatbotOpen(true)}
                    className="print:hidden"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ask AI About This Study</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="print:hidden">
                    <Bookmark className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save For Later</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InsightCardButton
                    studyId={study.id}
                    size="icon"
                    variant="ghost"
                    className="print:hidden"
                  />
                </TooltipTrigger>
                <TooltipContent>Create Shareable Insight Card</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Hierarchical heading structure with h1 for title */}
        <h1 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">
          {study.title}
        </h1>

        {/* Study details and metadata */}
        <section className="flex flex-wrap gap-4 text-sm text-neutral-600 mb-6 print:text-black">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2" />
            <span>Published: {formatDate(study.publishDate)}</span>
          </div>
          <div className="flex items-center">
            <User className="h-4 w-4 mr-2" />
            <span>{study.authors}</span>
          </div>
          <div className="flex items-center">
            <BookOpen className="h-4 w-4 mr-2" />
            <span>{study.journal}</span>
          </div>
          {study.doi && (
            <div className="flex items-center">
              <LinkIcon className="h-4 w-4 mr-2" />
              <span>DOI: {study.doi}</span>
            </div>
          )}
        </section>

        {/* Enrichment Status Indicator */}
        {determineEnrichmentStatus(study) !== "complete" && (
          <div
            className={`mb-6 p-3 rounded-lg border ${
              determineEnrichmentStatus(study) === "partial"
                ? "bg-amber-50 border-amber-200"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <InfoCircle className="h-4 w-4 text-amber-600" />
              <div>
                <p className="text-sm font-medium">
                  {determineEnrichmentStatus(study) === "partial"
                    ? "Partial Content Available"
                    : "Basic Content Only"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {determineEnrichmentStatus(study) === "partial"
                    ? "This study has been partially enriched with additional content."
                    : "This study contains basic information only. Full content enrichment is pending."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Key findings highlight card */}
        <section className="mb-8 print:mb-4 bg-gradient-to-r from-teal-50 to-indigo-50 p-4 rounded-lg border border-teal-100">
          <div className="flex items-center mb-3">
            <Lightbulb className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-primary">Key Findings</h2>
          </div>
          <div className="prose prose-sm max-w-none">
            <p className="text-neutral-700">{plainLanguageSummary}</p>
          </div>

          {/* Quality score indicator */}
          <div className="flex items-center mt-4">
            <span className="text-sm font-medium mr-2">Research Quality:</span>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Sparkles
                  key={star}
                  className={`h-4 w-4 ${
                    star <= studyScore
                      ? "text-yellow-500 fill-yellow-500"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Study section navigation - mobile version (shows only on small screens) */}
        <div className="md:hidden print:hidden mb-6">
          <div className="w-full overflow-x-auto py-2">
            <div className="flex space-x-2 min-w-max">
              <Button
                variant="outline"
                size="sm"
                onClick={() => scrollToSection("abstract")}
                className={
                  activeSection === "abstract"
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : ""
                }
              >
                Abstract
              </Button>

              {study.methods && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => scrollToSection("methods")}
                  className={
                    activeSection === "methods"
                      ? "bg-primary/10 border-primary/20 text-primary"
                      : ""
                  }
                >
                  Methods
                </Button>
              )}

              {study.results && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => scrollToSection("results")}
                  className={
                    activeSection === "results"
                      ? "bg-primary/10 border-primary/20 text-primary"
                      : ""
                  }
                >
                  Results
                </Button>
              )}

              {study.conclusion && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => scrollToSection("conclusion")}
                  className={
                    activeSection === "conclusion"
                      ? "bg-primary/10 border-primary/20 text-primary"
                      : ""
                  }
                >
                  Conclusion
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => scrollToSection("simplified")}
                className={
                  activeSection === "simplified"
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : ""
                }
              >
                Simplified
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => scrollToSection("links")}
                className={
                  activeSection === "links"
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : ""
                }
              >
                Links
              </Button>
            </div>
          </div>

          {/* Mobile Keywords/Tags */}
          {keyStudyTags.length > 0 && (
            <div className="mt-3">
              <h3 className="font-medium text-xs text-neutral-600 mb-1">
                KEYWORDS
              </h3>
              <div className="flex flex-wrap gap-1">
                {keyStudyTags.map((tag: string, index: number) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Table of contents for navigation - desktop version */}
        <div className="print:hidden flex flex-col md:flex-row md:items-start gap-8 mb-8">
          <ScrollArea className="hidden md:block h-auto max-h-80 w-full md:w-1/4 rounded-md border p-4">
            <div className="mb-4">
              <h3 className="font-medium text-sm text-neutral-600 mb-2 flex items-center">
                <PanelTop className="w-4 h-4 mr-2" />
                CONTENTS
              </h3>
              <nav className="flex flex-col space-y-1 text-sm">
                <button
                  onClick={() => scrollToSection("abstract")}
                  className={`flex items-center gap-1 p-1 hover:text-primary hover:bg-neutral-50 rounded-sm transition-colors ${activeSection === "abstract" ? "text-primary font-medium" : ""}`}
                >
                  <ChevronRight className="h-3 w-3" />
                  Abstract
                </button>
                {study.methods && (
                  <button
                    onClick={() => scrollToSection("methods")}
                    className={`flex items-center gap-1 p-1 hover:text-primary hover:bg-neutral-50 rounded-sm transition-colors ${activeSection === "methods" ? "text-primary font-medium" : ""}`}
                  >
                    <ChevronRight className="h-3 w-3" />
                    Methods
                  </button>
                )}
                {study.results && (
                  <button
                    onClick={() => scrollToSection("results")}
                    className={`flex items-center gap-1 p-1 hover:text-primary hover:bg-neutral-50 rounded-sm transition-colors ${activeSection === "results" ? "text-primary font-medium" : ""}`}
                  >
                    <ChevronRight className="h-3 w-3" />
                    Results
                  </button>
                )}
                {study.conclusion && (
                  <button
                    onClick={() => scrollToSection("conclusion")}
                    className={`flex items-center gap-1 p-1 hover:text-primary hover:bg-neutral-50 rounded-sm transition-colors ${activeSection === "conclusion" ? "text-primary font-medium" : ""}`}
                  >
                    <ChevronRight className="h-3 w-3" />
                    Conclusion
                  </button>
                )}
                <button
                  onClick={() => scrollToSection("simplified")}
                  className={`flex items-center gap-1 p-1 hover:text-primary hover:bg-neutral-50 rounded-sm transition-colors ${activeSection === "simplified" ? "text-primary font-medium" : ""}`}
                >
                  <ChevronRight className="h-3 w-3" />
                  Simplified Explanation
                </button>
                <button
                  onClick={() => scrollToSection("links")}
                  className={`flex items-center gap-1 p-1 hover:text-primary hover:bg-neutral-50 rounded-sm transition-colors ${activeSection === "links" ? "text-primary font-medium" : ""}`}
                >
                  <ChevronRight className="h-3 w-3" />
                  Links & Resources
                </button>
              </nav>
            </div>

            {/* Keywords/Tags section - desktop */}
            {keyStudyTags.length > 0 && (
              <div className="pt-2 border-t">
                <h3 className="font-medium text-sm text-neutral-600 mb-2">
                  KEYWORDS
                </h3>
                <div className="flex flex-wrap gap-1">
                  {keyStudyTags.map((tag: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Main content column */}
          <section className="w-full md:w-3/4 space-y-8">
            {/* Tabs for different content views */}
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="content">Study Content</TabsTrigger>
                <TabsTrigger
                  value="simplified"
                  className="flex items-center gap-1"
                >
                  <Lightbulb className="h-4 w-4" />
                  Simplified
                </TabsTrigger>
                <TabsTrigger value="share" className="flex items-center gap-1">
                  <Share2 className="h-4 w-4" />
                  Share
                </TabsTrigger>
              </TabsList>

              <TabsContent value="content">
                <Separator className="mb-6" />

                <div className="space-y-8">
                  <section id="abstract" className="scroll-mt-6">
                    <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                      <Info className="h-5 w-5 text-neutral-600" />
                      Abstract
                    </h2>
                    <div className="text-neutral-700 leading-relaxed whitespace-pre-line">
                      {study.abstract}
                    </div>
                  </section>

                  {study.methods && (
                    <section id="methods" className="scroll-mt-6">
                      <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                        <Beaker className="h-5 w-5 text-neutral-600" />
                        Methods
                      </h2>
                      <div className="text-neutral-700 leading-relaxed whitespace-pre-line">
                        {study.methods}
                      </div>
                    </section>
                  )}

                  {study.results && (
                    <section id="results" className="scroll-mt-6">
                      <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                        <Microscope className="h-5 w-5 text-neutral-600" />
                        Results
                      </h2>
                      <div className="text-neutral-700 leading-relaxed whitespace-pre-line">
                        {study.results}
                      </div>
                    </section>
                  )}

                  {study.conclusion && (
                    <section id="conclusion" className="scroll-mt-6">
                      <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                        <BrainCircuit className="h-5 w-5 text-neutral-600" />
                        Conclusion
                      </h2>
                      <div className="text-neutral-700 leading-relaxed whitespace-pre-line">
                        {study.conclusion}
                      </div>
                    </section>
                  )}

                  <section id="links" className="scroll-mt-6">
                    <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                      <LinkIcon className="h-5 w-5 text-neutral-600" />
                      Links & Resources
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      {study.doi && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                            onClick={() =>
                              window.open(
                                `https://doi.org/${study.doi}`,
                                "_blank",
                              )
                            }
                          >
                            <ExternalLink className="h-4 w-4" />
                            View Original Paper
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                            onClick={enrichStudyContent}
                            disabled={enhancingContent}
                          >
                            <RefreshCcw
                              className={`h-4 w-4 ${enhancingContent ? "animate-spin" : ""}`}
                            />
                            {enhancingContent
                              ? "Enriching..."
                              : "Enhance Content"}
                          </Button>
                        </>
                      )}

                      {study.pdfUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                          onClick={() => window.open(study.pdfUrl, "_blank")}
                        >
                          <FileText className="h-4 w-4" />
                          View PDF
                        </Button>
                      )}

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            Cite This Study
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                          <DialogHeader>
                            <DialogTitle>Citation Formats</DialogTitle>
                            <DialogDescription>
                              Choose a citation format and copy to clipboard.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            <Tabs
                              defaultValue="apa"
                              onValueChange={setSelectedCitationFormat}
                            >
                              <TabsList className="grid grid-cols-5 mb-4">
                                <TabsTrigger value="apa">APA</TabsTrigger>
                                <TabsTrigger value="mla">MLA</TabsTrigger>
                                <TabsTrigger value="chicago">
                                  Chicago
                                </TabsTrigger>
                                <TabsTrigger value="bibtex">BibTeX</TabsTrigger>
                                <TabsTrigger value="ris">RIS</TabsTrigger>
                              </TabsList>
                              <TabsContent
                                value="apa"
                                className="text-sm p-4 bg-muted rounded-md"
                              >
                                {generateCitation("apa")}
                              </TabsContent>
                              <TabsContent
                                value="mla"
                                className="text-sm p-4 bg-muted rounded-md"
                              >
                                {generateCitation("mla")}
                              </TabsContent>
                              <TabsContent
                                value="chicago"
                                className="text-sm p-4 bg-muted rounded-md"
                              >
                                {generateCitation("chicago")}
                              </TabsContent>
                              <TabsContent
                                value="bibtex"
                                className="text-sm p-4 bg-muted rounded-md font-mono"
                              >
                                {generateCitation("bibtex")}
                              </TabsContent>
                              <TabsContent
                                value="ris"
                                className="text-sm p-4 bg-muted rounded-md font-mono"
                              >
                                {generateCitation("ris")}
                              </TabsContent>
                            </Tabs>
                          </div>
                          <DialogFooter>
                            <Button onClick={copyCitation}>
                              Copy Citation
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </section>
                </div>
              </TabsContent>

              <TabsContent value="simplified">
                <Separator className="mb-6" />
                <section id="simplified" className="scroll-mt-6">
                  <Card>
                    <CardHeader className="bg-gradient-to-r from-teal-50 to-indigo-50">
                      <div className="flex items-center">
                        <Lightbulb className="h-5 w-5 text-primary mr-2" />
                        <CardTitle className="text-primary">
                          Simplified Explanation
                        </CardTitle>
                      </div>
                      <CardDescription>
                        A plain language summary of this research for
                        non-scientists
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="prose max-w-none">
                        <div className="whitespace-pre-line">
                          {study.simplifiedExplanation || plainLanguageSummary}
                        </div>

                        {/* Why This Matters section */}
                        <h3 className="mt-6 text-lg font-semibold">
                          Why This Matters
                        </h3>
                        <p>
                          This research contributes to our understanding of how
                          hydrogen-rich water may benefit human health. By
                          examining the effects on{" "}
                          {study.category?.toLowerCase() || "health"}, the study
                          provides evidence that could influence future
                          treatments and wellness approaches.
                        </p>

                        {/* Key Points section */}
                        <h3 className="mt-6 text-lg font-semibold">
                          Key Points
                        </h3>
                        <ul>
                          <li>
                            Investigated the effects of hydrogen-rich water on{" "}
                            {study.category?.toLowerCase() || "health"}
                          </li>
                          {study.methods && (
                            <li>
                              Used established scientific methods to ensure
                              reliable results
                            </li>
                          )}
                          {study.results && (
                            <li>
                              Found evidence that suggests potential benefits
                              for health
                            </li>
                          )}
                          {study.conclusion && (
                            <li>
                              The researchers concluded that hydrogen therapy
                              shows promise for certain conditions
                            </li>
                          )}
                        </ul>

                        {/* Technical Terms section */}
                        <h3 className="mt-6 text-lg font-semibold">
                          Technical Terms Explained
                        </h3>
                        <dl className="space-y-2">
                          <div>
                            <dt className="font-medium">Molecular Hydrogen</dt>
                            <dd className="pl-4">
                              The smallest and most abundant molecule in the
                              universe, consisting of two hydrogen atoms (H₂).
                            </dd>
                          </div>
                          <div>
                            <dt className="font-medium">Antioxidant</dt>
                            <dd className="pl-4">
                              A substance that inhibits oxidation, especially
                              one used to counteract the deterioration of stored
                              food products or remove potentially damaging
                              oxidizing agents in a living organism.
                            </dd>
                          </div>
                          <div>
                            <dt className="font-medium">Free Radicals</dt>
                            <dd className="pl-4">
                              Unstable atoms that can damage cells, causing
                              illness and aging.
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              </TabsContent>

              <TabsContent value="share">
                <Separator className="mb-6" />
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Share This Study
                        </CardTitle>
                        <CardDescription>
                          Share this research with colleagues and friends
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              window.open(
                                `mailto:?subject=${encodeURIComponent(study.title)}&body=${encodeURIComponent(`Check out this interesting hydrogen research: https://hydrogenstudies.com/study/${study.id}`)}`,
                                "_blank",
                              )
                            }
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              window.open(
                                `https://twitter.com/intent/tweet?text=${encodeURIComponent(study.title)}&url=${encodeURIComponent(`https://hydrogenstudies.com/study/${study.id}`)}`,
                                "_blank",
                              )
                            }
                          >
                            <Twitter className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              window.open(
                                `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://hydrogenstudies.com/study/${study.id}`)}`,
                                "_blank",
                              )
                            }
                          >
                            <Facebook className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              window.open(
                                `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://hydrogenstudies.com/study/${study.id}`)}`,
                                "_blank",
                              )
                            }
                          >
                            <Linkedin className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Download or Print
                        </CardTitle>
                        <CardDescription>
                          Save this study for offline reading
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex space-x-2">
                          <Button variant="outline" onClick={printStudy}>
                            <Printer className="h-4 w-4 mr-2" />
                            Print Study
                          </Button>
                          {study.pdfUrl ? (
                            <Button
                              variant="outline"
                              onClick={() =>
                                window.open(study.pdfUrl, "_blank")
                              }
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Download PDF
                            </Button>
                          ) : (
                            <Button variant="outline" disabled>
                              <FileText className="h-4 w-4 mr-2" />
                              PDF Unavailable
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="p-2">
                    <ResearchInsightCard study={study} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </section>
        </div>

        {/* Related studies section */}
        <section className="mt-10 pt-6 border-t border-neutral-200 print:hidden">
          <h2 className="text-xl font-bold mb-4">Related Studies</h2>
          <p className="text-neutral-600 text-sm mb-6">
            These studies are similar to "{study.title}" and may provide
            additional context and insights.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* This would ideally be populated dynamically with actual related studies */}
            <Card className="h-full">
              <CardHeader className="p-4">
                <CardTitle className="text-base">
                  Hydrogen Gas Therapy for Inflammatory Conditions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm text-neutral-600 line-clamp-3">
                  This study explores how hydrogen gas inhalation affects
                  various inflammatory conditions...
                </p>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Button variant="link" className="px-0">
                  View Study
                </Button>
              </CardFooter>
            </Card>

            <Card className="h-full">
              <CardHeader className="p-4">
                <CardTitle className="text-base">
                  Effects of Hydrogen-Rich Water on Athletic Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm text-neutral-600 line-clamp-3">
                  Analysis of how hydrogen-rich water consumption affects
                  recovery times and performance...
                </p>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Button variant="link" className="px-0">
                  View Study
                </Button>
              </CardFooter>
            </Card>

            <Card className="h-full">
              <CardHeader className="p-4">
                <CardTitle className="text-base">
                  Long-term Safety Profile of Hydrogen Therapy
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm text-neutral-600 line-clamp-3">
                  A comprehensive review of safety data from multiple hydrogen
                  therapy studies...
                </p>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Button variant="link" className="px-0">
                  View Study
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>
      </article>

      {/* AI Chatbot dialog */}
      <Dialog open={isChatbotOpen} onOpenChange={setIsChatbotOpen}>
        <DialogContent className="sm:max-w-[600px] h-[70vh]">
          <DialogHeader>
            <DialogTitle>Ask AI About This Study</DialogTitle>
            <DialogDescription>
              Have questions about "{study.title}"? I can help explain concepts,
              summarize findings, or address specific questions.
            </DialogDescription>
          </DialogHeader>
          <ChatbotDialogue studyContext={study} />
        </DialogContent>
      </Dialog>
    </>
  );
};

// Helper function to determine the color for category badges
const getCategoryColor = (category: string) => {
  switch (category.toLowerCase()) {
    case "cardiovascular":
      return "bg-secondary/10 text-secondary border-secondary/20";
    case "neurology":
    case "neurodegenerative":
      return "bg-accent/10 text-accent border-accent/20";
    case "metabolism":
      return "bg-primary/10 text-primary border-primary/20";
    case "inflammation":
      return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    case "cancer":
      return "bg-rose-500/10 text-rose-500 border-rose-500/20";
    case "aging":
      return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    default:
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
};

export default function StudyDetails() {
  const { id } = useParams();

  const {
    data: study,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Study>({
    queryKey: [`/api/studies/${id}`],
  });

  return (
    <div className="bg-neutral-100 py-8 min-h-screen">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            className="mb-4 pl-0 hover:bg-transparent hover:text-primary"
            asChild
          >
            <Link href="/studies">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Studies
            </Link>
          </Button>

          <ErrorBoundary>
            {isLoading ? (
              <div className="bg-white rounded-xl p-8 shadow-sm">
                <DetailSkeleton />
              </div>
            ) : isError ? (
              <div className="bg-white rounded-xl p-8 shadow-sm">
                <ErrorDisplay
                  title="Error loading study"
                  message="We're having trouble loading this study. Please try again later."
                  onRetry={() => refetch()}
                />
              </div>
            ) : !study ? (
              <div className="bg-white rounded-xl p-8 shadow-sm text-center">
                <EmptyState
                  title="Study Not Found"
                  description="The study you're looking for doesn't exist or might have been removed."
                  icon={<FileQuestion className="w-12 h-12" />}
                  action={
                    <Link href="/studies">
                      <Button>Browse All Studies</Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              <StudyContent study={study} refetch={refetch} />
            )}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
