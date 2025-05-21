import React from 'react';

interface JsonLdProps {
  type: string;
  data: Record<string, any>;
}

/**
 * Component to inject JSON-LD structured data into page head
 * This helps search engines better understand page content
 */
export const JsonLd: React.FC<JsonLdProps> = ({ type, data }) => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': type,
    ...data
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
};

/**
 * Generate structured data specifically for medical article pages
 */
export const generateMedicalArticleSchema = (study: any) => {
  return {
    '@type': 'MedicalScholarlyArticle',
    'headline': study.title,
    'name': study.title,
    'author': study.authors ? study.authors.split(',').map((author: string) => ({
      '@type': 'Person',
      'name': author.trim()
    })) : [{ '@type': 'Person', 'name': 'Research Team' }],
    'abstract': study.abstract,
    'description': study.abstract?.substring(0, 200) + '...',
    'datePublished': study.publishDate,
    'publisher': {
      '@type': 'Organization',
      'name': study.journal || 'Scientific Journal',
    },
    'about': [
      {
        '@type': 'MedicalTherapy',
        'name': 'Hydrogen Therapy',
        'relevantSpecialty': 'Alternative Medicine'
      },
      {
        '@type': 'MedicalCondition',
        'name': study.category || 'Health Condition'
      }
    ],
    'keywords': [
      'hydrogen therapy', 
      'molecular hydrogen', 
      'h2 therapy',
      study.category?.toLowerCase() || 'health research',
      'medical research'
    ],
    'isAccessibleForFree': study.fullTextAvailable || false,
    'image': study.imageUrl || '/default-study-image.jpg',
  };
};

/**
 * Generate breadcrumb structured data for navigation paths
 */
export const generateBreadcrumbSchema = (items: Array<{name: string, url: string}>) => {
  return {
    '@type': 'BreadcrumbList',
    'itemListElement': items.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name,
      'item': item.url
    }))
  };
};

/**
 * Generate FAQ structured data for pages with frequently asked questions
 */
export const generateFaqSchema = (questions: Array<{question: string, answer: string}>) => {
  return {
    '@type': 'FAQPage',
    'mainEntity': questions.map(item => ({
      '@type': 'Question',
      'name': item.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': item.answer
      }
    }))
  };
};

export default JsonLd;