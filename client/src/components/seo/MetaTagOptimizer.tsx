/**
 * Meta Tag Optimizer for Enhanced SEO Performance
 * Provides advanced meta tag optimization for different page types
 */

import React from 'react';
import { Helmet } from 'react-helmet';

interface MetaTagOptimizerProps {
  pageType: 'home' | 'study' | 'category' | 'search' | 'list';
  title: string;
  description: string;
  keywords?: string[];
  canonicalUrl?: string;
  study?: {
    id: number;
    title: string;
    authors: string;
    journal: string;
    publishDate: string;
    doi?: string;
    abstract: string;
    category: string;
    imageUrl?: string;
    keywords?: string[]; // Added keyword here.
  };
  category?: {
    name: string;
    studyCount: number;
    description?: string;
  };
}

export const MetaTagOptimizer: React.FC<MetaTagOptimizerProps> = ({
  pageType,
  title,
  description,
  keywords = [],
  canonicalUrl,
  study,
  category
}) => {
  const baseUrl = window.location.origin;
  const currentUrl = canonicalUrl || window.location.href;

  // Generate page-specific optimizations
  const getPageSpecificTags = () => {
    switch (pageType) {
      case 'home':
        return {
          robots: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
          priority: '1.0',
          changefreq: 'daily'
        };

      case 'study':
        return {
          robots: 'index, follow, max-snippet:160, max-image-preview:large',
          priority: '0.8',
          changefreq: 'monthly',
          articleType: 'research'
        };

      case 'category':
        return {
          robots: 'index, follow, max-snippet:200, max-image-preview:standard',
          priority: '0.7',
          changefreq: 'weekly'
        };

      case 'search':
        return {
          robots: 'noindex, follow',
          priority: '0.3',
          changefreq: 'never'
        };

      case 'list':
        return {
          robots: 'index, follow, max-snippet:150',
          priority: '0.6',
          changefreq: 'daily'
        };

      default:
        return {
          robots: 'index, follow',
          priority: '0.5',
          changefreq: 'weekly'
        };
    }
  };

  const pageConfig = getPageSpecificTags();

  // Generate optimized keywords
  const getOptimizedKeywords = () => {
    const baseKeywords = ['hydrogen therapy', 'molecular hydrogen', 'hydrogen research'];

    if (study) {
      return [
        ...baseKeywords,
        study.category.toLowerCase(),
        ...study.authors.split(',').map(a => a.trim()).slice(0, 2),
        study.journal.toLowerCase(),
        ...keywords
      ].filter(Boolean).slice(0, 20);
    }

    if (category) {
      return [
        ...baseKeywords,
        category.name.toLowerCase(),
        'health studies',
        'medical research',
        ...keywords
      ].filter(Boolean).slice(0, 15);
    }

    return [...baseKeywords, ...keywords].slice(0, 10);
  };

  const optimizedKeywords = getOptimizedKeywords();

  // Generate optimized description
  const getOptimizedDescription = () => {
    if (description) return description;

    if (study) {
      const benefits = study.keywords?.slice(0, 2).join(', ') || 'health benefits';
      return `${study.title.substring(0, 120)}. Learn about ${benefits} from this ${study.journal} study. Evidence-based research with plain-language summary.`;
    }

    if (category) {
      const studyCount = category.studyCount || 'multiple';
      return `Discover ${studyCount} research studies on ${category.name}. Evidence-based insights into hydrogen therapy benefits, safety, and clinical applications.`;
    }

    return 'Evidence-based hydrogen therapy research database. Access 1000+ studies with AI-powered analysis, safety information, and practical health insights.';
  };

  const optimizedDescription = getOptimizedDescription();

  return (
    <Helmet>
      {/* Core Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={optimizedDescription} />
      <meta name="keywords" content={optimizedKeywords.join(', ')} />
      <link rel="canonical" href={currentUrl} />

      {/* Robots and Indexing */}
      <meta name="robots" content={pageConfig.robots} />
      <meta name="googlebot" content={pageConfig.robots} />

      {/* Open Graph Enhanced */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={optimizedDescription} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:type" content={pageType === 'study' ? 'article' : 'website'} />
      <meta property="og:site_name" content="Hydrogen Research Database" />

      {/* Twitter Card Enhanced */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={optimizedDescription} />
      <meta name="twitter:site" content="@hydrogenstudies" />

      {/* Study-specific meta tags */}
      {study && (
        <>
          <meta property="article:published_time" content={study.publishDate} />
          <meta property="article:author" content={study.authors} />
          <meta property="article:section" content={study.category} />
          <meta name="citation_title" content={study.title} />
          <meta name="citation_author" content={study.authors} />
          <meta name="citation_publication_date" content={study.publishDate} />
          <meta name="citation_journal_title" content={study.journal} />
          {study.doi && <meta name="citation_doi" content={study.doi} />}
          {study.imageUrl && (
            <>
              <meta property="og:image" content={study.imageUrl} />
              <meta name="twitter:image" content={study.imageUrl} />
            </>
          )}
        </>
      )}

      {/* Category-specific meta tags */}
      {category && (
        <>
          <meta name="category" content={category.name} />
          <meta name="study-count" content={category.studyCount.toString()} />
        </>
      )}

      {/* Performance and Technical Meta Tags */}
      <meta name="theme-color" content="#0066cc" />
      <meta name="msapplication-TileColor" content="#0066cc" />
      <meta name="format-detection" content="telephone=no" />

      {/* Structured Data Hints */}
      <meta name="google-site-verification" content="your-verification-code" />
      <meta name="bing-site-verification" content="your-bing-verification" />

      {/* Performance Hints */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://api.hydrogenstudies.com" />
      <link rel="dns-prefetch" href="//www.google-analytics.com" />
    </Helmet>
  );
};

export default MetaTagOptimizer;