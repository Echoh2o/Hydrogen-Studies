import React from "react";
import { Helmet } from "react-helmet";

// Supported schema types
type SchemaType =
  | "Organization"
  | "WebSite"
  | "WebPage"
  | "Article"
  | "MedicalScholarlyArticle"
  | "FAQPage"
  | "BreadcrumbList"
  | "Course"
  | "Person"
  | "Product";

interface JsonLdProps {
  type: SchemaType;
  data: Record<string, any>;
}

/**
 * Component for adding structured data (JSON-LD) to pages
 * This helps search engines understand content and improves rich snippet opportunities
 */
const JsonLd: React.FC<JsonLdProps> = ({ type, data }) => {
  const schemaData = {
    "@context": "https://schema.org",
    "@type": type,
    ...data,
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schemaData)}</script>
    </Helmet>
  );
};

/**
 * Generate structured data for a medical scholarly article
 */
export const generateMedicalArticleSchema = (study: any) => {
  return {
    "@type": "MedicalScholarlyArticle",
    headline: study.title,
    abstract: study.abstract,
    author: {
      "@type": "Person",
      name: study.authors,
    },
    datePublished: study.publishDate,
    publisher: {
      "@type": "Organization",
      name: study.journal,
    },
    about: [
      {
        "@type": "MedicalCondition",
        name: study.category,
      },
      {
        "@type": "Thing",
        name: "Hydrogen Therapy",
      },
    ],
    url: `https://hydrogenstudies.com/study/${study.id}`,
    ...(study.doi && { sameAs: `https://doi.org/${study.doi}` }),
    ...(study.imageUrl && { image: study.imageUrl }),
    ...(study.methods && { methodDescription: study.methods }),
    ...(study.results && { resultDescription: study.results }),
    ...(study.conclusion && { conclusion: study.conclusion }),
    keywords: `hydrogen therapy, molecular hydrogen, ${study.category.toLowerCase()}, research study, health effects`,
    articleSection: study.category,
  };
};

/**
 * Generate structured data for breadcrumb navigation
 */
export const generateBreadcrumbSchema = (
  items: Array<{ name: string; url: string }>,
) => {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
};

/**
 * Generate structured data for educational course content
 */
export const generateCourseSchema = (course: {
  name: string;
  description: string;
  provider?: string;
  url: string;
  imageUrl?: string;
}) => {
  return {
    "@type": "Course",
    name: course.name,
    description: course.description,
    provider: {
      "@type": "Organization",
      name: course.provider || "HydrogenStudies.com",
      url: "https://hydrogenstudies.com",
    },
    url: course.url,
    ...(course.imageUrl && { image: course.imageUrl }),
  };
};

/**
 * Generate structured data for FAQ section
 */
export const generateFaqSchema = (
  faqs: Array<{ question: string; answer: string }>,
) => {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
};

/**
 * Generate structured data for a product
 */
export const generateProductSchema = (product: {
  name: string;
  description: string;
  image: string;
  url: string;
  brand: string;
  price?: number;
  currency?: string;
  reviewCount?: number;
  reviewRating?: number;
  sku?: string;
}) => {
  return {
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.image,
    url: product.url,
    brand: {
      "@type": "Brand",
      name: product.brand,
    },
    ...(product.price &&
      product.currency && {
        offers: {
          "@type": "Offer",
          price: product.price,
          priceCurrency: product.currency,
          url: product.url,
          availability: "https://schema.org/InStock",
        },
      }),
    ...(product.reviewCount &&
      product.reviewRating && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: product.reviewRating,
          reviewCount: product.reviewCount,
        },
      }),
    ...(product.sku && { sku: product.sku }),
  };
};

/**
 * Generate schema for organization
 */
export const generateOrganizationSchema = (organization: {
  name: string;
  url: string;
  logo: string;
  description?: string;
  socialLinks?: string[];
}) => {
  return {
    "@type": "Organization",
    name: organization.name,
    url: organization.url,
    logo: organization.logo,
    ...(organization.description && { description: organization.description }),
    ...(organization.socialLinks && { sameAs: organization.socialLinks }),
  };
};

export default JsonLd;
