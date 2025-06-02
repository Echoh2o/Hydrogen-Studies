// Production optimizations for faster deployment
export const productionConfig = {
  // Reduce bundle size by lazy loading heavy components
  enableLazyLoading: true,
  
  // Cache settings for better performance
  staticAssetCaching: {
    maxAge: 31536000, // 1 year for static assets
    immutable: true
  },
  
  // API response caching
  apiCaching: {
    defaultTTL: 300, // 5 minutes
    taggedStudiesTTL: 600, // 10 minutes for tagged studies
    searchResultsTTL: 180 // 3 minutes for search results
  },
  
  // Build optimizations
  buildOptimizations: {
    minifyJS: true,
    minifyCSS: true,
    removeDebugCode: true,
    enableGzip: true
  }
};

// Memory optimization for large datasets
export const memoryOptimizations = {
  // Pagination for large result sets
  defaultPageSize: 20,
  maxPageSize: 100,
  
  // Lazy load study details
  lazyLoadStudyContent: true,
  
  // Cache frequently accessed data
  enableMemoryCache: true,
  maxCacheSize: 100 // MB
};