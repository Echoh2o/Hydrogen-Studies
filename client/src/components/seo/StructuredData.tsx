/**
 * Structured Data Component for SEO Enhancement
 * Generates JSON-LD schema markup for research studies
 */

import React from "react";
import { Helmet } from "react-helmet";

interface Study {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  doi?: string;
  keywords?: string[];
  category: string;
  imageUrl?: string;
}

interface StructuredDataProps {
  study?: Study;
  type: "study" | "organization" | "website" | "breadcrumb";
  breadcrumbs?: Array<{ name: string; url: string }>;
}

export const StructuredData: React.FC<StructuredDataProps> = ({
  study,
  type,
  breadcrumbs,
}) => {
  const generateStudySchema = (study: Study) => ({
    "@context": "https://schema.org",
    "@type": ["Article", "ScholarlyArticle"],
    headline: study.title,
    description: study.abstract?.substring(0, 200),
    author: {
      "@type": "Person",
      name: study.authors?.split(",")[0] || "Research Team",
    },
    publisher: {
      "@type": "Organization",
      name: "Hydrogen Research Database",
      logo: {
        "@type": "ImageObject",
        url: `${window.location.origin}/favicon.svg`,
      },
    },
    datePublished: study.publishDate,
    dateModified: study.publishDate,
    image: {
      "@type": "ImageObject",
      url: study.imageUrl,
      width: 800,
      height: 600,
    },
    about: {
      "@type": "MedicalCondition",
      name: study.category,
    },
    keywords: study.keywords?.join(", "),
    citation: {
      "@type": "CreativeWork",
      name: study.journal,
      identifier: study.doi,
    },
    inLanguage: "en-US",
    isAccessibleForFree: true,
  });

  const generateOrganizationSchema = () => ({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Hydrogen Research Database",
    url: window.location.origin,
    logo: `${window.location.origin}/logo.png`,
    description:
      "Comprehensive database of hydrogen health research studies with advanced categorization and search capabilities",
    foundingDate: "2023",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "info@hydrogenstudies.com",
    },
    sameAs: [
      "https://twitter.com/hydrogenstudies",
      "https://linkedin.com/company/hydrogenstudies",
    ],
  });

  const generateWebsiteSchema = () => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Hydrogen Research Database",
    url: window.location.origin,
    description:
      "Advanced hydrogen health research database with AI-powered categorization",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${window.location.origin}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    publisher: {
      "@type": "Organization",
      name: "Hydrogen Research Database",
    },
  });

  const generateBreadcrumbSchema = (
    breadcrumbs: Array<{ name: string; url: string }>,
  ) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  });

  const getSchemaData = () => {
    switch (type) {
      case "study":
        return study ? generateStudySchema(study) : null;
      case "organization":
        return generateOrganizationSchema();
      case "website":
        return generateWebsiteSchema();
      case "breadcrumb":
        return breadcrumbs ? generateBreadcrumbSchema(breadcrumbs) : null;
      default:
        return null;
    }
  };

  const schemaData = getSchemaData();

  if (!schemaData) return null;

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schemaData)}</script>
    </Helmet>
  );
};

export default StructuredData;
