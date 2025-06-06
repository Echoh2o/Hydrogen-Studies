/**
 * Structured Data Component for SEO Enhancement
 * Generates JSON-LD schema markup for research studies
 */

import React from 'react';
import { Helmet } from 'react-helmet';

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
  type: 'study' | 'organization' | 'website' | 'breadcrumb';
  breadcrumbs?: Array<{ name: string; url: string }>;
}

export const StructuredData: React.FC<StructuredDataProps> = ({ study, type, breadcrumbs }) => {
  const generateStudySchema = (study: Study) => ({
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    "name": study.title,
    "headline": study.title,
    "description": study.abstract,
    "author": {
      "@type": "Person",
      "name": study.authors
    },
    "publisher": {
      "@type": "Organization",
      "name": study.journal || "Hydrogen Research Database",
      "logo": {
        "@type": "ImageObject",
        "url": `${window.location.origin}/logo.png`
      }
    },
    "datePublished": study.publishDate,
    "dateModified": study.publishDate,
    "url": `${window.location.origin}/studies/${study.id}`,
    "identifier": {
      "@type": "PropertyValue",
      "propertyID": "DOI",
      "value": study.doi
    },
    "keywords": study.keywords?.join(", ") || study.category,
    "about": {
      "@type": "MedicalCondition",
      "name": "Hydrogen Therapy Research"
    },
    "image": study.imageUrl ? {
      "@type": "ImageObject",
      "url": study.imageUrl,
      "caption": `Research visualization for ${study.title}`
    } : undefined,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${window.location.origin}/studies/${study.id}`
    },
    "citation": study.doi ? `https://doi.org/${study.doi}` : undefined
  });

  const generateOrganizationSchema = () => ({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Hydrogen Research Database",
    "url": window.location.origin,
    "logo": `${window.location.origin}/logo.png`,
    "description": "Comprehensive database of hydrogen health research studies with advanced categorization and search capabilities",
    "foundingDate": "2023",
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "email": "info@hydrogenstudies.com"
    },
    "sameAs": [
      "https://twitter.com/hydrogenstudies",
      "https://linkedin.com/company/hydrogenstudies"
    ]
  });

  const generateWebsiteSchema = () => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Hydrogen Research Database",
    "url": window.location.origin,
    "description": "Advanced hydrogen health research database with AI-powered categorization",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${window.location.origin}/search?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Hydrogen Research Database"
    }
  });

  const generateBreadcrumbSchema = (breadcrumbs: Array<{ name: string; url: string }>) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  });

  const getSchemaData = () => {
    switch (type) {
      case 'study':
        return study ? generateStudySchema(study) : null;
      case 'organization':
        return generateOrganizationSchema();
      case 'website':
        return generateWebsiteSchema();
      case 'breadcrumb':
        return breadcrumbs ? generateBreadcrumbSchema(breadcrumbs) : null;
      default:
        return null;
    }
  };

  const schemaData = getSchemaData();

  if (!schemaData) return null;

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schemaData)}
      </script>
    </Helmet>
  );
};

export default StructuredData;