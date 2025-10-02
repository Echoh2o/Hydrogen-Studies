/**
 * Performance Optimizer for Enhanced SEO and User Experience
 * Implements Core Web Vitals optimization and progressive loading
 */

import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";

interface PerformanceOptimizerProps {
  enableLazyLoading?: boolean;
  enablePreloading?: boolean;
  criticalResources?: string[];
}

export const PerformanceOptimizer: React.FC<PerformanceOptimizerProps> = ({
  enableLazyLoading = true,
  enablePreloading = true,
  criticalResources = [],
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Implement progressive loading for better Core Web Vitals
    if (enableLazyLoading) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
            }
          });
        },
        { threshold: 0.1 },
      );
    }

    // Preload critical resources
    if (enablePreloading && criticalResources.length > 0) {
      criticalResources.forEach((resource) => {
        const link = document.createElement("link");
        link.rel = "preload";
        link.href = resource;

        if (resource.includes(".woff2")) {
          link.as = "font";
          link.type = "font/woff2";
          link.crossOrigin = "anonymous";
        } else if (resource.includes(".css")) {
          link.as = "style";
        } else if (resource.includes(".js")) {
          link.as = "script";
        }

        document.head.appendChild(link);
      });
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [enableLazyLoading, enablePreloading, criticalResources]);

  return (
    <Helmet>
      {/* Core Web Vitals Optimization */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link rel="preconnect" href="https://api.hydrogenstudies.com" />

      {/* DNS Prefetch for external resources */}
      <link rel="dns-prefetch" href="//www.google-analytics.com" />
      <link rel="dns-prefetch" href="//fonts.googleapis.com" />

      {/* Resource Hints for better loading */}
      <link
        rel="preload"
        href="/fonts/inter-var.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />

      {/* Critical CSS inlining hint */}
      <style
        type="text/css"
        dangerouslySetInnerHTML={{
          __html: `
          /* Critical CSS for above-the-fold content */
          .hero-section { display: block; }
          .search-section { display: block; }
          body { font-family: 'Inter', system-ui, sans-serif; }
        `,
        }}
      />

      {/* Performance monitoring */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
          // Core Web Vitals monitoring
          if ('web-vital' in window) {
            window.webVitals.getCLS(console.log);
            window.webVitals.getFID(console.log);
            window.webVitals.getLCP(console.log);
          }
          
          // Progressive loading indicator
          window.addEventListener('load', function() {
            document.body.classList.add('loaded');
          });
        `,
        }}
      />
    </Helmet>
  );
};

export default PerformanceOptimizer;
