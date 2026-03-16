import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  HiArrowLeft,
  HiDownload,
  HiExternalLink,
  HiUser,
  HiBookOpen,
  HiCalendar,
  HiDocumentText,
  HiClipboardCheck,
  HiPhotograph,
  HiShare,
  HiHeart,
} from "react-icons/hi";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";
import RelatedBlogs from "@/components/studies/related-blogs";
import RelatedContent from "@/components/RelatedContent";
import JsonLd, {
  generateMedicalArticleSchema,
  generateBreadcrumbSchema,
} from "@/components/seo/JsonLd";
import SEOHead from "@/components/seo/SEOHead";
import StructuredData from "@/components/seo/StructuredData";
import React, { Component, type ReactNode, useEffect, useRef } from "react";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";

import StudyImage from "@/components/studies/StudyImage";
import { useAuth } from "@/components/auth/ProtectedRoute";

/** Detect which hydrogen delivery methods are relevant to a study */
function detectDeliveryMethods(study: any): { method: string; emoji: string; title: string; description: string; filter: string }[] {
  if (!study) return [];

  const text = [study.title, study.abstract, study.methods, study.results, study.conclusion, study.category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Check for stored how_to_apply JSON first
  if (study.howToApply || study.how_to_apply) {
    try {
      const parsed = JSON.parse(study.howToApply || study.how_to_apply);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }

  const methods: { method: string; emoji: string; title: string; description: string; filter: string }[] = [];

  // Detect hydrogen water / drinking
  const drinkingPatterns = /hydrogen.?rich water|hrw|drinking|oral intake|dissolved hydrogen|hydrogen water|ingestion|beverage|consumption|electrolyz/;
  if (drinkingPatterns.test(text)) {
    const conditions = (study.healthConditions || study.health_conditions || []).slice(0, 2).join(" and ");
    methods.push({
      method: "drinking",
      emoji: "\u{1F4A7}",
      title: "Hydrogen Water",
      description: conditions
        ? `This study used hydrogen-rich water and found potential benefits for ${conditions}. Explore Echo hydrogen water machines for convenient daily use.`
        : "This study used hydrogen-rich water as its delivery method. Explore Echo hydrogen water machines for convenient daily use.",
      filter: "drinking-water",
    });
  }

  // Detect inhalation
  const inhalationPatterns = /inhalation|inhaling|breathing|h2 gas|hydrogen gas|gaseous hydrogen|nasal cannula|ventilat/;
  if (inhalationPatterns.test(text)) {
    const conditions = (study.healthConditions || study.health_conditions || []).slice(0, 2).join(" and ");
    methods.push({
      method: "inhalation",
      emoji: "\u{1FAC1}",
      title: "Hydrogen Inhalation",
      description: conditions
        ? `This research used hydrogen gas inhalation to address ${conditions}. The Echo Refresh provides professional-grade hydrogen inhalation at home.`
        : "This research studied hydrogen gas inhalation therapy. The Echo Refresh provides professional-grade hydrogen inhalation at home.",
      filter: "inhalation",
    });
  }

  // Detect bathing / topical
  const bathingPatterns = /bath|bathing|topical|dermal|skin|immersion|soak|wound|hydrogen.?saline/;
  if (bathingPatterns.test(text)) {
    methods.push({
      method: "bathing",
      emoji: "\u{1F6C1}",
      title: "Hydrogen Baths",
      description: "This study suggests hydrogen absorption through the skin may provide benefits. The Echo Revive bath machine makes hydrogen-enriched bathing easy.",
      filter: "bathing",
    });
  }

  // If no specific method detected, default to hydrogen water (most common)
  if (methods.length === 0) {
    methods.push({
      method: "drinking",
      emoji: "\u{1F4A7}",
      title: "Hydrogen Water",
      description: "Molecular hydrogen research like this study supports the potential health benefits of hydrogen-rich water. Explore Echo hydrogen water products.",
      filter: "drinking-water",
    });
  }

  return methods;
}

/** Study-specific "How to Apply This Research" section */
function HowToApplySection({ study }: { study: any }) {
  const methods = detectDeliveryMethods(study);

  return (
    <section aria-labelledby="practical-heading" className="mb-6 md:mb-8">
      <h2
        id="practical-heading"
        className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-purple-600"
      >
        How to Apply This Research
      </h2>
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 md:p-6">
        <div className="space-y-4">
          {methods.map((m) => (
            <div key={m.method} className="flex items-start space-x-3">
              <div className="w-8 h-8 md:w-6 md:h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-purple-600 text-base md:text-sm font-semibold">
                  {m.emoji}
                </span>
              </div>
              <div className="flex-1">
                <Link href={`/products?filter=${m.filter}`} className="group">
                  <h3 className="font-medium text-purple-800 text-sm md:text-base group-hover:text-purple-900 underline decoration-2 decoration-purple-300 hover:decoration-purple-500 transition-colors">
                    {m.title}
                  </h3>
                  <p className="text-xs md:text-sm text-purple-700 leading-relaxed">
                    {m.description}
                  </p>
                </Link>
              </div>
            </div>
          ))}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-xs md:text-sm text-yellow-800 leading-relaxed">
              <strong>Remember:</strong> Always talk to your doctor before
              starting any new health routine. These are research findings, not
              medical advice.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Extract YouTube video ID from various URL formats */
function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Error boundary for the entire study page
class StudyErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  state: { hasError: boolean; error?: Error } = { hasError: false };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <>
          <SiteHeader />
          <div className="max-w-4xl mx-auto px-4 py-8">
            <Card className="max-w-md mx-auto">
              <CardContent className="pt-6 pb-6 text-center">
                <h1 className="text-xl font-bold mb-4">Something went wrong</h1>
                <p className="text-neutral-600 mb-4">
                  This study couldn't be displayed. Please try refreshing the page.
                </p>
                {this.state.error && (
                  <details className="mt-2 text-xs text-left">
                    <summary>Error details</summary>
                    <pre className="mt-1 whitespace-pre-wrap">{this.state.error.message}</pre>
                  </details>
                )}
                <div className="mt-4">
                  <Link href="/recent-studies">
                    <Button>
                      <HiArrowLeft className="mr-2" />
                      Browse Recent Studies
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
          <Footer />
        </>
      );
    }
    return this.props.children;
  }
}

const StudyPageContent = () => {
  const { id } = useParams();
  const studyId = id ? parseInt(id) : 0; // Provide fallback to prevent NaN
  const { toast } = useToast();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const queryClient = useQueryClient();

  // Define the Study type to match what's returned from the API
  interface Study {
    id: number;
    title: string;
    plainLanguageTitle?: string;
    plain_language_title?: string; // Added to handle snake_case from API
    slug?: string;
    abstract: string;
    authors: string;
    journal: string;
    publishDate: string;
    category: string;
    methods?: string;
    results?: string;
    conclusion?: string;
    doi?: string;
    pdfUrl?: string;
    citationUrl?: string;
    imageUrl?: string;
    image_url?: string; // Added to handle snake_case from API
    imageAlt?: string;
    image_alt?: string; // Added to handle snake_case from API
    autoGeneratedImage?: boolean;
    auto_generated_image?: boolean; // Added to handle snake_case from API
    year?: number;
    publishYear?: number; // Added to handle the publish year field
    studyType?: string;
    videoUrl?: string;
    video_url?: string;
    citations?: number;
    fullTextAvailable?: boolean;
    tldr?: string;
    howToApply?: string;
    how_to_apply?: string;
    healthConditions?: string[];
    health_conditions?: string[];
  }

  const {
    data: study,
    isLoading,
    error,
  } = useQuery<Study>({
    queryKey: [`/api/studies/${studyId}`],
  });

  // Create fallback image directly as base64-encoded SVG data URI
  const fallbackImageBase64 =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjUwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjUwMCIgZmlsbD0iI2UyZjNmZiIvPjx0ZXh0IHg9IjQwMCIgeT0iMjUwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiMwMDMzNjYiPkh5ZHJvZ2VuIFJlc2VhcmNoIFN0dWR5PC90ZXh0PjxjaXJjbGUgY3g9IjQwMCIgY3k9IjM1MCIgcj0iNDAiIGZpbGw9IiMwMDY2Y2MiIG9wYWNpdHk9IjAuNyIvPjxjaXJjbGUgY3g9IjM0MCIgY3k9IjM1MCIgcj0iNDAiIGZpbGw9IiMwMDMzNjYiIG9wYWNpdHk9IjAuNyIvPjxsaW5lIHgxPSIzNzAiIHkxPSIzNTAiIHgyPSI0MzAiIHkyPSIzNTAiIHN0cm9rZT0iIzAwMzM2NiIgc3Ryb2tlLXdpZHRoPSI0Ii8+PC9zdmc+";

  // Special case for study #1000 that has known issues
  const study1000ImageBase64 =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjUwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjUwMCIgZmlsbD0iI2UyZjNmZiIvPjx0ZXh0IHg9IjQwMCIgeT0iMTUwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiMwMDMzNjYiPlN0dWR5ICMxMDAwPC90ZXh0Pjx0ZXh0IHg9IjQwMCIgeT0iMjAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiMwMDMzNjYiIGZvbnQtd2VpZ2h0PSJib2xkIj5GdXR1cmUgRGlyZWN0aW9ucyBpbiBIeWRyb2dlbiBTdHVkaWVzPC90ZXh0Pjx0ZXh0IHg9IjQwMCIgeT0iMjUwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiMwMDMzNjYiPlN1biwgWHVlanVuLCBPaHRhLCBTaGlnZW88L3RleHQ+PHRleHQgeD0iNDAwIiB5PSIyOTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzAwMzM2NiI+SHlkcm9nZW4gTW9sZWN1bGFyIEJpb2xvZ3kgYW5kIE1lZGljaW5lICgyMDE1KTwvdGV4dD48Y2lyY2xlIGN4PSI0MDAiIGN5PSIzODAiIHI9IjQwIiBmaWxsPSIjMDA2NmNjIiBvcGFjaXR5PSIwLjciLz48Y2lyY2xlIGN4PSIzNDAiIGN5PSIzODAiIHI9IjQwIiBmaWxsPSIjMDAzMzY2IiBvcGFjaXR5PSIwLjciLz48bGluZSB4MT0iMzcwIiB5MT0iMzgwIiB4Mj0iNDMwIiB5Mj0iMzgwIiBzdHJva2U9IiMwMDMzNjYiIHN0cm9rZS13aWR0aD0iNCIvPjwvc3ZnPg==";

  // Enhanced helper function to process image URLs correctly and handle all edge cases
  const getProcessedImageUrl = (study?: Study) => {
    if (!study) return fallbackImageBase64;

    // Special handling for study #1000
    if (studyId === 1000) {
      return study1000ImageBase64;
    }

    // Check for both camelCase and snake_case property names
    const imageUrl = study.imageUrl || study.image_url;

    // If no URL provided or it's null/empty, use fallback
    if (!imageUrl || imageUrl.trim() === "") return fallbackImageBase64;

    // If it's already a data URI, use it directly
    if (imageUrl.startsWith("data:")) {
      return imageUrl;
    }

    // If it's already a fully qualified URL (starts with http/https), use it directly
    if (imageUrl.startsWith("http")) {
      // Sometimes external URLs might have issues, if it's a placeholder service, use our embedded fallback
      if (imageUrl.includes("placehold.co")) {
        return fallbackImageBase64;
      }
      return imageUrl;
    }

    // For any other case, use our embedded fallback to ensure something always displays
    return fallbackImageBase64;
  };

  // Mutation for generating an AI image for this study
  const generateImageMutation = useMutation({
    mutationFn: () => {
      return fetch(`/api/images/generate/${studyId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }).then((res) => {
        if (!res.ok) throw new Error("Failed to generate image");
        return res.json();
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/studies/${studyId}`] });
      toast({
        title: "Image Generated Successfully",
        description:
          "A new scientific visualization has been created for this study.",
      });
    },
    onError: (error) => {
      console.error("Image generation error:", error);
      toast({
        title: "Image Generation Failed",
        description: "Unable to generate an image. Please try again later.",
        variant: "destructive",
      });
    },
  });

  const generateTldrMutation = useMutation({
    mutationFn: () => {
      return fetch(`/api/studies/${studyId}/generate-tldr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).then((res) => {
        if (!res.ok) throw new Error("Failed to generate TLDR");
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/studies/${studyId}`] });
      toast({ title: "TLDR Generated", description: "A simplified summary has been created." });
    },
    onError: () => {
      toast({ title: "TLDR Generation Failed", description: "Please try again later.", variant: "destructive" });
    },
  });

  // Get related studies (same category, exclude current) — limited query
  const { data: relatedData } = useQuery<any>({
    queryKey: ["/api/studies", { category: study?.category, limit: "4" }],
    enabled: !!study?.category,
  });
  const relatedArray = Array.isArray(relatedData?.data) ? relatedData.data : Array.isArray(relatedData) ? relatedData : [];
  const relatedStudies = relatedArray
    .filter((s: any) => s.id !== studyId)
    .slice(0, 3);

  if (isLoading) {
    return (
      <>
        <SiteHeader />
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
        <Footer />
      </>
    );
  }

  if (error || !study) {
    return (
      <>
        <SiteHeader />
        <div className="min-h-screen bg-white py-12">
          <div className="container mx-auto px-4 text-center">
            <Card className="max-w-md mx-auto">
              <CardContent className="pt-6 pb-6">
                <h1 className="text-xl font-bold mb-4">Study Not Found</h1>
                <p className="text-neutral-600 mb-6">
                  {error instanceof Error
                    ? error.message
                    : "We couldn't find the study you're looking for. It may have been removed or the ID is incorrect."}
                </p>
                <Link href="/recent-studies">
                  <Button>
                    <HiArrowLeft className="mr-2" />
                    Browse Recent Studies
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>
          {study.plainLanguageTitle ||
            study.plain_language_title ||
            study.title}{" "}
          | Hydrogen Studies Research
        </title>
        <meta
          name="description"
          content={(study.abstract || "").substring(0, 160) + "..."}
        />
        <meta
          name="keywords"
          content={`hydrogen therapy, molecular hydrogen, ${(study.category || '').toLowerCase()}, research study, scientific evidence, health effects`}
        />
        <meta name="author" content={study.authors} />
        <meta name="date" content={study.publishDate} />
        <link
          rel="canonical"
          href={`https://hydrogenstudies.com/study/${study.slug || study.id}`}
        />

        {/* Open Graph Tags */}
        <meta
          property="og:title"
          content={`${study.plainLanguageTitle || study.plain_language_title || study.title} | Hydrogen Studies`}
        />
        <meta
          property="og:description"
          content={(study.abstract || "").substring(0, 200) + "..."}
        />
        <meta property="og:type" content="article" />
        <meta
          property="og:url"
          content={`https://hydrogenstudies.com/study/${study.slug || study.id}`}
        />
        <meta
          property="og:image"
          content={study.imageUrl || study.image_url || fallbackImageBase64}
        />
        <meta property="article:published_time" content={study.publishDate} />
        {study.category && <meta property="article:section" content={study.category} />}

        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content={
            study.plainLanguageTitle ||
            study.plain_language_title ||
            study.title
          }
        />
        <meta
          name="twitter:description"
          content={(study.abstract || "").substring(0, 200) + "..."}
        />
        <meta
          name="twitter:image"
          content={study.imageUrl || study.image_url || fallbackImageBase64}
        />
      </Helmet>

      {/* Structured Data */}
      <JsonLd
        type="MedicalScholarlyArticle"
        data={generateMedicalArticleSchema(study)}
      />

      {/* Breadcrumb Schema */}
      <JsonLd
        type="BreadcrumbList"
        data={generateBreadcrumbSchema([
          { name: "Home", url: "https://hydrogenstudies.com" },
          {
            name: "Research Studies",
            url: "https://hydrogenstudies.com/studies",
          },
          ...(study.category ? [{
            name: study.category,
            url: `https://hydrogenstudies.com/category/${encodeURIComponent(study.category)}`,
          }] : []),
          {
            name: study.title,
            url: `https://hydrogenstudies.com/study/${study.slug || study.id}`,
          },
        ])}
      />

      <section className="bg-white py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mb-6">
              <ol
                className="flex items-center text-sm text-neutral-500"
                itemScope
                itemType="https://schema.org/BreadcrumbList"
              >
                <li
                  itemProp="itemListElement"
                  itemScope
                  itemType="https://schema.org/ListItem"
                  className="inline-flex items-center"
                >
                  <Link href="/">
                    <span
                      itemProp="name"
                      className="hover:text-primary cursor-pointer"
                    >
                      Home
                    </span>
                  </Link>
                  <meta itemProp="position" content="1" />
                  <span className="mx-2" aria-hidden="true">
                    /
                  </span>
                </li>
                <li
                  itemProp="itemListElement"
                  itemScope
                  itemType="https://schema.org/ListItem"
                  className="inline-flex items-center"
                >
                  <Link href="/categories">
                    <span
                      itemProp="name"
                      className="hover:text-primary cursor-pointer"
                    >
                      Categories
                    </span>
                  </Link>
                  <meta itemProp="position" content="2" />
                  <span className="mx-2" aria-hidden="true">
                    /
                  </span>
                </li>
                {study.category && (
                <li
                  itemProp="itemListElement"
                  itemScope
                  itemType="https://schema.org/ListItem"
                  className="inline-flex items-center"
                >
                  <Link
                    href={`/category/${encodeURIComponent(study.category.toLowerCase())}`}
                  >
                    <span
                      itemProp="name"
                      className="hover:text-primary cursor-pointer"
                    >
                      {study.category}
                    </span>
                  </Link>
                  <meta itemProp="position" content="3" />
                  <span className="mx-2" aria-hidden="true">
                    /
                  </span>
                </li>
                )}
                <li
                  itemProp="itemListElement"
                  itemScope
                  itemType="https://schema.org/ListItem"
                  className="inline-flex items-center"
                  aria-current="page"
                >
                  <span itemProp="name" className="text-neutral-800">
                    Study
                  </span>
                  <meta itemProp="position" content="4" />
                </li>
              </ol>
            </nav>

            {/* Mobile-Optimized Study Header */}
            <header className="mb-6 md:mb-8">
              {/* Mobile-first category and date */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
                {study.category && (
                <Badge
                  variant="secondary"
                  className="bg-primary/10 text-primary hover:bg-primary/15 w-fit"
                >
                  {study.category}
                </Badge>
                )}
                {study.year && (
                  <time
                    dateTime={study.year.toString()}
                    className="text-neutral-500 flex items-center text-sm"
                  >
                    <HiCalendar className="mr-1 w-4 h-4" aria-hidden="true" />
                    {study.publishDate
                      ? new Date(study.publishDate).toLocaleDateString(
                          "en-GB",
                          { day: "2-digit", month: "2-digit", year: "numeric" },
                        )
                      : study.year}
                  </time>
                )}
              </div>

              {/* SEO-optimized main title with academic subtitle */}
              {study.plainLanguageTitle || study.plain_language_title ? (
                <div className="mb-4">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 leading-tight text-primary">
                    {study.plainLanguageTitle || study.plain_language_title}
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

              {/* Mobile-friendly metadata stack */}
              <div className="space-y-2 md:space-y-0 md:flex md:flex-wrap md:items-center text-neutral-600 text-sm">
                <div className="flex items-center">
                  <HiUser
                    className="mr-2 w-4 h-4 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span itemProp="author" className="line-clamp-1">
                    {study.authors}
                  </span>
                </div>
                <div className="flex items-center md:ml-6">
                  <HiBookOpen
                    className="mr-2 w-4 h-4 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span itemProp="publisher" className="line-clamp-1">
                    {study.journal}
                  </span>
                </div>
                <div className="flex items-center md:ml-6">
                  <HiCalendar
                    className="mr-2 w-4 h-4 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {study.publishDate
                      ? new Date(study.publishDate).toLocaleDateString(
                          "en-GB",
                          { day: "2-digit", month: "2-digit", year: "numeric" },
                        )
                      : study.year || "Date not available"}
                  </span>
                </div>
              </div>
            </header>

            {/* Mobile-Optimized Study Content */}
            <article
              className="bg-white border border-neutral-200 rounded-lg md:rounded-xl shadow-sm mb-6 md:mb-10"
              itemScope
              itemType="https://schema.org/MedicalScholarlyArticle"
            >
              <div className="p-4 sm:p-6 md:p-8">
                <section aria-labelledby="visualization-heading">
                  <h2
                    id="visualization-heading"
                    className="text-xl font-semibold mb-4"
                  >
                    Research Visualization
                  </h2>
                  {/* Study Image - Simplified implementation */}
                  <figure className="mb-8 rounded-lg overflow-hidden">
                    <div className="relative">
                      {/* StudyImage component that handles all fallback cases */}
                      <StudyImage
                        studyId={studyId}
                        imageUrl={study.imageUrl || study.image_url}
                        imageAlt={study.imageAlt || study.image_alt}
                        title={study.title}
                        authors={study.authors}
                        journal={study.journal}
                        year={study.publishYear || study.year}
                      />

                      {/* Generate Image Button - Admin only */}
                      {isAdmin && (
                        <div className="absolute bottom-0 left-0 right-0 bg-neutral-800/70 p-3 flex justify-center">
                          <Button
                            variant="secondary"
                            className="flex items-center gap-2 bg-white hover:bg-neutral-100"
                            onClick={() => generateImageMutation.mutate()}
                            disabled={generateImageMutation.isPending}
                          >
                            <HiPhotograph className="w-4 h-4" />
                            {generateImageMutation.isPending
                              ? "Generating..."
                              : "Generate Scientific Visual"}
                          </Button>
                        </div>
                      )}
                    </div>

                    <figcaption className="flex justify-between items-start mt-2">
                      <p className="text-xs text-neutral-500 italic">
                        {study.autoGeneratedImage || study.auto_generated_image
                          ? "AI-generated visualization of the study's hydrogen mechanisms and effects"
                          : "Visual representation of hydrogen effects related to this research"}
                      </p>

                      {/* Image attribution if available */}
                      {(study.imageAlt || study.image_alt) && (
                        <span className="text-xs text-neutral-400">
                          {study.imageAlt || study.image_alt}
                        </span>
                      )}
                    </figcaption>
                  </figure>
                </section>

                {/* Mobile-Optimized Simple Summary Section */}
                {(study as any).summaryMarkdown && (
                  <section
                    aria-labelledby="summary-heading"
                    className="mb-6 md:mb-8"
                  >
                    <h2
                      id="summary-heading"
                      className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-teal-600"
                    >
                      What This Study Means for You
                    </h2>
                    <div className="bg-teal-50 border-l-4 border-teal-400 p-4 md:p-6 rounded-r-lg">
                      <div className="prose prose-sm md:prose max-w-none prose-teal">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize((study as any).summaryMarkdown),
                          }}
                        />
                      </div>
                    </div>
                  </section>
                )}

                {/* Mobile-Optimized Key Benefits Section */}
                {(study as any).keywords &&
                  (study as any).keywords.length > 0 && (
                    <section
                      aria-labelledby="benefits-heading"
                      className="mb-6 md:mb-8"
                    >
                      <h2
                        id="benefits-heading"
                        className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-green-600"
                      >
                        Key Health Benefits Found
                      </h2>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 md:p-6">
                        <div className="flex flex-wrap gap-2">
                          {(study as any).keywords
                            .slice(0, 6)
                            .map((keyword: string) => (
                              <Badge
                                key={keyword}
                                variant="outline"
                                className="bg-green-100 text-green-800 border-green-300 text-xs md:text-sm"
                              >
                                {keyword}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    </section>
                  )}

                {/* TLDR - Super Simplified Summary */}
                {((study as any).tldr || isAdmin) && (
                  <section aria-labelledby="tldr-heading" className="mb-6 md:mb-8">
                    <h2
                      id="tldr-heading"
                      className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-blue-600"
                    >
                      TL;DR
                    </h2>
                    {(study as any).tldr ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 md:p-6">
                        <p className="text-base md:text-lg text-blue-900 leading-relaxed font-medium">
                          {(study as any).tldr}
                        </p>
                      </div>
                    ) : isAdmin ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 md:p-6 text-center">
                        <p className="text-sm text-blue-700 mb-3">No TLDR generated yet.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateTldrMutation.mutate()}
                          disabled={generateTldrMutation.isPending}
                        >
                          {generateTldrMutation.isPending ? "Generating..." : "Generate TLDR"}
                        </Button>
                      </div>
                    ) : null}
                  </section>
                )}

                <section aria-labelledby="abstract-heading">
                  <h2
                    id="abstract-heading"
                    className="text-xl font-semibold mb-4"
                  >
                    Research Abstract
                  </h2>
                  <div className="prose max-w-none prose-neutral mb-8" itemProp="abstract">
                    <div
                      className="text-lg leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(study.abstract || ""),
                      }}
                    />
                  </div>
                </section>

                {/* Video Section */}
                {(study.videoUrl || study.video_url) && (() => {
                  const videoUrl = study.videoUrl || study.video_url || "";
                  const youtubeId = getYouTubeId(videoUrl);
                  if (!youtubeId) return null;
                  return (
                    <section aria-labelledby="video-heading">
                      <Separator className="my-6" />
                      <h2
                        id="video-heading"
                        className="text-xl font-semibold mb-4"
                      >
                        Research Video
                      </h2>
                      <div className="relative w-full mb-6" style={{ paddingBottom: "56.25%" }}>
                        <iframe
                          className="absolute top-0 left-0 w-full h-full rounded-lg"
                          src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
                          title={`Video: ${study.title}`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </section>
                  );
                })()}

                {/* Methods Section */}
                {study.methods && (
                  <section aria-labelledby="methods-heading">
                    <Separator className="my-6" />
                    <h2
                      id="methods-heading"
                      className="text-xl font-semibold mb-4"
                    >
                      Methods
                    </h2>
                    <div
                      className="prose max-w-none prose-neutral mb-6"
                      itemProp="methodDescription"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(study.methods),
                      }}
                    />
                  </section>
                )}

                {/* Results Section */}
                {study.results && (
                  <section aria-labelledby="results-heading">
                    <Separator className="my-6" />
                    <h2
                      id="results-heading"
                      className="text-xl font-semibold mb-4"
                    >
                      Results
                    </h2>
                    <div
                      className="prose max-w-none prose-neutral mb-6"
                      itemProp="resultDescription"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(study.results),
                      }}
                    />
                  </section>
                )}

                {/* Study-Specific Practical Application Section */}
                <HowToApplySection study={study} />

                {study.conclusion && (
                  <section aria-labelledby="conclusion-heading">
                    <Separator className="my-6" />
                    <h2
                      id="conclusion-heading"
                      className="text-xl font-semibold mb-4"
                    >
                      Research Conclusion
                    </h2>
                    <div
                      className="prose max-w-none prose-neutral mb-6"
                      itemProp="conclusion"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(study.conclusion),
                      }}
                    />
                  </section>
                )}

                {/* Study Metadata */}
                <Separator className="my-6" />
                <section aria-labelledby="metadata-heading" className="mt-6">
                  <h2 id="metadata-heading" className="sr-only">
                    Study Metadata
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {study.doi && (
                      <div>
                        <p className="text-sm font-medium text-neutral-500 mb-1">
                          DOI Reference
                        </p>
                        <p className="text-sm">
                          <a
                            href={`https://doi.org/${study.doi}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center"
                            itemProp="identifier"
                          >
                            {study.doi} <HiExternalLink className="ml-1" />
                          </a>
                        </p>
                      </div>
                    )}

                    {study.pdfUrl && (
                      <div>
                        <p className="text-sm font-medium text-neutral-500 mb-1">
                          Full Text Access
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center text-sm"
                          asChild
                        >
                          <a
                            href={study.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <HiDownload className="mr-1" /> Download PDF
                          </a>
                        </Button>
                      </div>
                    )}

                    {study.citationUrl && (
                      <div>
                        <p className="text-sm font-medium text-neutral-500 mb-1">
                          Citation Information
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center text-sm"
                          asChild
                        >
                          <a
                            href={study.citationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <HiClipboardCheck className="mr-1" /> Copy Citation
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </article>

            {/* Mobile-Optimized Related Studies Section */}
            {relatedStudies.length > 0 && (
              <section
                aria-labelledby="related-studies-heading"
                className="mt-8 md:mt-12"
              >
                <h2
                  id="related-studies-heading"
                  className="text-xl md:text-2xl font-bold mb-4 md:mb-6"
                >
                  Related Studies
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  {relatedStudies.map((relatedStudy: any) => (
                    <Link
                      key={relatedStudy.id}
                      href={
                        relatedStudy.slug
                          ? `/study/${relatedStudy.slug}`
                          : `/study/id/${relatedStudy.id}`
                      }
                    >
                      <Card className="h-full hover:shadow-md transition-shadow">
                        <CardContent className="p-4 md:p-5">
                          <Badge
                            variant="outline"
                            className="mb-2 md:mb-3 text-xs"
                          >
                            {relatedStudy.category}
                          </Badge>
                          <h3 className="font-bold mb-2 line-clamp-2 text-sm md:text-base">
                            {relatedStudy.title}
                          </h3>
                          <p className="text-xs md:text-sm text-neutral-600 line-clamp-3">
                            {relatedStudy.abstract}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Mobile Floating Action Button */}
            <div className="fixed bottom-6 right-4 md:hidden z-40">
              <div className="flex flex-col gap-3">
                <Button
                  size="icon"
                  className="w-12 h-12 rounded-full bg-teal-500 hover:bg-teal-600 shadow-lg"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: study.title,
                        text: `Check out this hydrogen research study: ${study.title}`,
                        url: window.location.href,
                      });
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      toast({
                        title: "Link Copied!",
                        description: "Study link copied to clipboard",
                      });
                    }
                  }}
                >
                  <HiShare className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Related Blogs */}
            <section aria-labelledby="related-blogs-heading" className="mt-12">
              <h2 id="related-blogs-heading" className="sr-only">
                Related Blog Articles
              </h2>
              <RelatedBlogs studyId={study.id} />
            </section>

            {/* Smart Internal Links */}
            <RelatedContent contentType="study" contentId={study.id} title="Explore Related Research" />
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
};

export default function StudyPage() {
  return (
    <StudyErrorBoundary>
      <StudyPageContent />
    </StudyErrorBoundary>
  );
}
