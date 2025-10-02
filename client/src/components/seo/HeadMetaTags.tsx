import React from "react";
import { Helmet } from "react-helmet";

interface HeadMetaTagsProps {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
  section?: string;
  noIndex?: boolean;
  alternateLanguages?: Array<{ lang: string; url: string }>;
  children?: React.ReactNode;
}

/**
 * Comprehensive SEO head meta tags component that follows best practices
 * Implements canonical tags, mobile viewport settings, and full social sharing markup
 */
const HeadMetaTags: React.FC<HeadMetaTagsProps> = ({
  title,
  description,
  keywords,
  canonicalUrl,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = "website",
  twitterTitle,
  twitterDescription,
  twitterImage,
  datePublished,
  dateModified,
  author,
  section,
  noIndex = false,
  alternateLanguages = [],
  children,
}) => {
  // Default domain for absolute URLs
  const domain = "https://hydrogenstudies.com";

  // Format absolute URL for canonical and og:url - with safety check for undefined
  const absoluteUrl = canonicalUrl
    ? canonicalUrl.startsWith("http")
      ? canonicalUrl
      : `${domain}${canonicalUrl}`
    : `${domain}/`;

  // Format image URLs to be absolute
  const formattedOgImage = ogImage?.startsWith("http")
    ? ogImage
    : ogImage
      ? `${domain}${ogImage}`
      : undefined;
  const formattedTwitterImage = twitterImage?.startsWith("http")
    ? twitterImage
    : twitterImage
      ? `${domain}${twitterImage}`
      : undefined;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Canonical Tag - Essential for SEO */}
      <link rel="canonical" href={absoluteUrl} />

      {/* Alternate Language Tags */}
      {alternateLanguages.map((alt) => (
        <link
          key={alt.lang}
          rel="alternate"
          hrefLang={alt.lang}
          href={alt.url.startsWith("http") ? alt.url : `${domain}${alt.url}`}
        />
      ))}

      {/* Mobile Optimization */}
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1, shrink-to-fit=no"
      />

      {/* Search Engine Directives */}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta
          name="robots"
          content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
        />
      )}

      {/* Open Graph Tags */}
      <meta property="og:title" content={ogTitle || title} />
      <meta property="og:description" content={ogDescription || description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={absoluteUrl} />
      {formattedOgImage && (
        <meta property="og:image" content={formattedOgImage} />
      )}
      <meta property="og:site_name" content="Hydrogen Studies" />

      {/* Additional Open Graph Tags for Articles */}
      {ogType === "article" && datePublished && (
        <meta property="article:published_time" content={datePublished} />
      )}
      {ogType === "article" && dateModified && (
        <meta property="article:modified_time" content={dateModified} />
      )}
      {ogType === "article" && author && (
        <meta property="article:author" content={author} />
      )}
      {ogType === "article" && section && (
        <meta property="article:section" content={section} />
      )}

      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={twitterTitle || ogTitle || title} />
      <meta
        name="twitter:description"
        content={twitterDescription || ogDescription || description}
      />
      {formattedTwitterImage && (
        <meta name="twitter:image" content={formattedTwitterImage} />
      )}

      {/* Additional tags passed as children */}
      {children}
    </Helmet>
  );
};

export default HeadMetaTags;
