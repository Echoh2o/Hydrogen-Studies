/**
 * SEO Head Component for Hydrogen Research Platform
 * Generates optimized meta tags, Open Graph, and Twitter Card data
 */

import React from 'react';
import { Helmet } from 'react-helmet';

interface SEOHeadProps {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  publishDate?: string;
  modifiedDate?: string;
  authors?: string;
  keywords?: string[];
  category?: string;
  doi?: string;
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  canonicalUrl,
  ogImage,
  ogType = 'website',
  publishDate,
  modifiedDate,
  authors,
  keywords = [],
  category,
  doi
}) => {
  const baseUrl = window.location.origin;
  const currentUrl = canonicalUrl || window.location.href;
  const defaultImage = `${baseUrl}/og-image.jpg`;
  const imageUrl = ogImage || defaultImage;

  // Clean and optimize title
  const cleanTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;
  const siteTitle = "Hydrogen Research Database";
  const fullTitle = title.includes(siteTitle) ? title : `${cleanTitle} | ${siteTitle}`;

  // Clean and optimize description
  const cleanDescription = description.length > 160 
    ? description.substring(0, 157) + '...' 
    : description;

  // Generate keywords string
  const keywordsString = [
    ...keywords,
    'hydrogen therapy',
    'molecular hydrogen',
    'hydrogen research',
    'health studies',
    category
  ].filter(Boolean).join(', ');

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={cleanDescription} />
      <meta name="keywords" content={keywordsString} />
      <link rel="canonical" href={currentUrl} />

      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={cleanTitle} />
      <meta property="og:description" content={cleanDescription} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={siteTitle} />
      <meta property="og:locale" content="en_US" />

      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={cleanTitle} />
      <meta name="twitter:description" content={cleanDescription} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:site" content="@hydrogenstudies" />

      {/* Article-specific Meta Tags */}
      {ogType === 'article' && (
        <>
          {publishDate && <meta property="article:published_time" content={publishDate} />}
          {modifiedDate && <meta property="article:modified_time" content={modifiedDate} />}
          {authors && <meta property="article:author" content={authors} />}
          {category && <meta property="article:section" content={category} />}
          {keywords.map((keyword, index) => (
            <meta key={index} property="article:tag" content={keyword} />
          ))}
        </>
      )}

      {/* Research-specific Meta Tags */}
      {doi && <meta name="citation_doi" content={doi} />}
      {authors && <meta name="citation_author" content={authors} />}
      {publishDate && <meta name="citation_publication_date" content={publishDate} />}
      <meta name="citation_title" content={title} />

      {/* Additional SEO Meta Tags */}
      <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
      <meta name="googlebot" content="index, follow" />
      <meta name="theme-color" content="#0066cc" />
      <meta name="msapplication-TileColor" content="#0066cc" />

      {/* Mobile Optimization */}
      <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
      <meta name="format-detection" content="telephone=no" />

      {/* Performance Hints */}
      <link rel="dns-prefetch" href="//fonts.googleapis.com" />
      <link rel="preconnect" href="https://api.hydrogenstudies.com" />
    </Helmet>
  );
};

export default SEOHead;