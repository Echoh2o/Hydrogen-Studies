/**
 * SEO-Optimized Image Component
 * Provides WebP support, lazy loading, and proper SEO attributes
 */

import React, { useState, useRef, useEffect } from "react";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  fallback?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = "",
  width,
  height,
  priority = false,
  fallback = "/images/fallback-study-image.svg",
}) => {
  const [imageSrc, setImageSrc] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority) {
      // Load immediately for above-the-fold images
      loadImage();
    } else {
      // Use Intersection Observer for lazy loading
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              loadImage();
              observer.unobserve(entry.target);
            }
          });
        },
        {
          rootMargin: "50px 0px", // Start loading 50px before entering viewport
        },
      );

      if (imgRef.current) {
        observer.observe(imgRef.current);
      }

      return () => {
        if (imgRef.current) {
          observer.unobserve(imgRef.current);
        }
      };
    }
  }, [src, priority]);

  const loadImage = () => {
    // Check WebP support and use optimized version if available
    const webpSrc = src.replace(/\.(png|jpg|jpeg)$/, ".webp");
    const optimizedSrc = src.includes("/study-images/")
      ? src
          .replace("/study-images/", "/study-images/optimized/")
          .replace(/\.(png|jpg|jpeg)$/, ".webp")
      : webpSrc;

    // Test if WebP version exists
    const testImg = new Image();
    testImg.onload = () => {
      setImageSrc(optimizedSrc);
    };
    testImg.onerror = () => {
      // Fallback to original if WebP not available
      setImageSrc(src);
    };
    testImg.src = optimizedSrc;
  };

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImageSrc(fallback);
    }
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {/* Loading placeholder */}
      {!isLoaded && !hasError && (
        <div
          className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center"
          style={{ width, height }}
        >
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Main image */}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        className={`
          transition-opacity duration-300 
          ${isLoaded ? "opacity-100" : "opacity-0"}
          ${className}
        `}
        onLoad={handleLoad}
        onError={handleError}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        // SEO attributes
        itemProp="image"
        aria-describedby={`${alt.replace(/\s+/g, "-").toLowerCase()}-description`}
      />

      {/* Hidden description for screen readers */}
      <span
        id={`${alt.replace(/\s+/g, "-").toLowerCase()}-description`}
        className="sr-only"
      >
        {alt}
      </span>
    </div>
  );
};

export default OptimizedImage;
