# HydrogenStudies.com Research Database

## Overview

HydrogenStudies.com is a comprehensive research platform that aggregates, enhances, and presents hydrogen therapy research studies in an accessible format for both researchers and consumers. The platform combines academic rigor with user-friendly presentation, featuring AI-enhanced content, automated image generation, and intelligent search capabilities.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for build optimization
- **UI Library**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with compiled production stylesheets
- **State Management**: TanStack React Query for server state management
- **Build Tool**: Vite with optimized production builds targeting modern browsers

### Backend Architecture
- **Runtime**: Node.js 20 with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with type-safe queries
- **API Design**: RESTful endpoints with Zod validation schemas
- **Performance**: In-memory caching with TTL-based invalidation
- **Health Monitoring**: Real-time health checks with automatic recovery

### Data Storage Solutions
- **Primary Database**: PostgreSQL 16 with connection pooling
- **ORM**: Drizzle with schema-first approach and migration support
- **Caching Layer**: Simple in-memory cache with 10-minute TTL
- **Search Optimization**: Full-text search with JSONB indexing
- **Performance Indexes**: 35 targeted indexes for common query patterns

## Key Components

### Study Management System
- **Data Model**: Comprehensive study schema with enhanced metadata fields
- **Content Enhancement**: AI-powered plain language summaries and explanations
- **Image Generation**: OpenAI DALL-E 3 integration for study visualizations
- **Quality Assurance**: Automated data validation and enrichment processes

### Search and Discovery
- **Full-Text Search**: PostgreSQL-based search with semantic query expansion
- **Advanced Filtering**: Category, date range, author, and keyword filters
- **Pagination**: Optimized pagination with configurable page sizes
- **Trending Analysis**: Real-time tracking of popular searches and studies

### Content Enhancement Pipeline
- **AI Integration**: OpenAI GPT-4o for content generation and improvement
- **Research Enrichment**: Integration with PubMed, CrossRef, and Europe PMC APIs
- **Consumer-Friendly Content**: Automated generation of simplified explanations
- **SEO Optimization**: Automated meta descriptions, keywords, and slug generation

### Administrative Tools
- **Health Monitoring**: Comprehensive system health tracking and alerting
- **Performance Analytics**: Database query optimization and cache hit rate monitoring
- **Content Management**: Bulk operations for study enhancement and categorization
- **Migration System**: Automated database schema updates and data migrations

## Data Flow

1. **Data Ingestion**: Studies are imported from academic databases and manually curated sources
2. **Content Enhancement**: AI systems generate plain language summaries, images, and SEO metadata
3. **Quality Validation**: Automated checks ensure data completeness and accuracy
4. **Search Indexing**: Full-text indexes are updated for optimal search performance
5. **Content Delivery**: Cached responses provide fast access to enhanced study data
6. **User Interaction**: Search queries and user preferences inform content recommendations

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL with WebSocket connections
- **Deployment**: Replit with Cloud Run for production scaling
- **CDN**: Static assets served through optimized build pipeline

### AI and Enhancement Services
- **OpenAI**: GPT-4o for content generation and DALL-E 3 for image creation
- **Research APIs**: PubMed, Europe PMC, CrossRef, and Semantic Scholar for data enrichment
- **SendGrid**: Email notifications and newsletter delivery

### Development Tools
- **Package Management**: npm with lock file for dependency consistency
- **Type Safety**: TypeScript with strict configuration across all modules
- **Code Quality**: ESLint and Prettier for consistent code formatting
- **Testing**: Comprehensive error handling with graceful degradation

## Deployment Strategy

### Development Environment
- **Local Development**: Hot-reload development server with TypeScript compilation
- **Database**: Local PostgreSQL with migration support
- **Environment Variables**: Development-specific configuration

### Production Environment
- **Build Process**: Vite production build with code splitting and optimization
- **Server**: Node.js production server with health monitoring
- **Database**: Optimized PostgreSQL with connection pooling and performance indexes
- **Caching**: Production-ready caching with automatic cleanup
- **Monitoring**: Comprehensive error tracking and performance monitoring

### Performance Optimizations
- **Startup Time**: Optimized from 15+ seconds to under 2 seconds
- **Query Performance**: Sub-100ms response times for search operations
- **Memory Management**: Efficient caching with automatic cleanup
- **Database Optimization**: 35 performance indexes for common query patterns

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- October 1, 2025: Critical Security Fix - Protected All Admin Routes
  - Fixed navigation issue by replacing non-existent useNavigate with useLocation from wouter library
  - Wrapped ALL admin routes with ProtectedRoute component to prevent unauthorized access
  - Implemented role-based access control (admin-only for sensitive routes, admin/editor for content management)
  - Added proper authentication flow with redirect to login page when accessing protected routes
  - Fixed apiRequest calls to use correct signature (method, url, data, throwOnError)
  - Removed invalid 'size' prop from Badge components throughout the application
  - Authentication routes (/login, /register) now properly integrated into main routing

- June 19, 2025: Implemented AI-powered blog recommendation and auto-generation system
  - Built working blog recommendation API that analyzes studies and suggests blog topics
  - Added priority-based recommendations with SEO keywords and article type suggestions
  - Implemented bulk blog generation with OpenAI GPT-4o integration for content creation
  - Added fallback content generation for reliable operation when AI services timeout
  - Fixed all database column issues (added video_url field) and TypeScript compilation errors
  - System generates complete blog articles with titles, content, summaries, and SEO-optimized slugs
  - Added proper error handling and timeout management for robust API performance
  - Blog recommendation system now functional in admin interface with bulk selection capabilities

- June 19, 2025: Fixed blog creation functionality and admin dashboard statistics
  - Added missing POST/PUT endpoints to server/routes/blog-routes.ts with proper Zod validation
  - Fixed slug validation pattern to match client-side requirements (lowercase letters, numbers, hyphens only)
  - Added study selection dropdown to blog creation form with first 50 studies available
  - Resolved "Study ID is required" error by implementing proper study connection interface
  - Dashboard endpoint fixed - EnhancedAdminDashboard now queries correct /api/stats/dashboard
  - Dashboard shows authentic data: 1,304 studies, 13 blogs (after test creation), proper statistics
  - Added mobile navigation to admin pages using AdminLayout wrapper
  - Blog creation form now validates properly and connects to actual studies
  - All validation errors resolved - both client-side and server-side validation working
  - Complete blog management workflow now functional from creation to publication

- June 17, 2025: Fixed admin pages API endpoints and TypeScript errors
  - Resolved keyword monitor schedule API by adding `/schedule` route alias
  - Fixed batch enrichment API endpoints by registering enrichment routes
  - Created batch-specific endpoints (/api/enrichment/batch/status, /api/enrichment/batch/start, /api/enrichment/batch/stop)
  - Corrected BatchEnrichmentPage TypeScript interface to match actual API response structure
  - Fixed JSX syntax errors and data access patterns in admin components
  - All admin pages now return proper JSON responses instead of HTML

- June 17, 2025: Fixed research import API endpoints
  - Resolved "Not Valid JSON" error in /admin/research-import page
  - Properly registered research unified routes in main server
  - PubMed, Europe PMC, and CrossRef searches now returning valid JSON responses
  - Improved Europe PMC query logic for broader search results
  - Research database searches functional across multiple external APIs

- June 16, 2025: Major navigation restructuring and page consolidation
  - Eliminated /research page and integrated Studies navigation into homepage header
  - Consolidated /learn page content into /benefits page for unified Benefits & Education experience
  - Removed duplicate pages: LearnPage.tsx, ContactPage.tsx, home.tsx, NewHomePage.tsx
  - Added Studies dropdown menu to homepage header with comprehensive study browsing options
  - Updated mobile menu to include organized Studies section with all navigation options
  - Studies navigation now includes: All Studies, Recent Studies, By Health Condition, By Body System, By Life Stage, By Delivery Method, By Health Benefit, and Research Insights
  - Enhanced BenefitsPage with learning pathways, quick facts, and comprehensive educational content
  - Added AI Assistant access to homepage header navigation for both desktop and mobile
  - Updated site title from "HydrogenHealth" to "Hydrogen Studies" to better reflect the research focus
  - Created SiteHeader component and deployed standardized navigation to all non-admin pages
  - All public pages now have consistent header navigation with Studies dropdown, AI Assistant access, and unified branding
  - Cleaned up deprecated header files: removed Header.tsx, header.tsx, footer.tsx duplicates and App-Clean.tsx
  - Single source navigation system now uses only SiteHeader.tsx component
  - Moved About link from main navigation to footer for cleaner header design
  - Added SiteHeader to all pages: Studies, Blog, Chat, Research Analytics, Benefits, Products
  - Navigation now consistently includes: Studies dropdown, Blog, Benefits, Analytics, Products, AI Assistant

## Changelog

Changelog:
- June 16, 2025. Initial setup
- June 16, 2025. Navigation restructuring - eliminated /research page, integrated Studies into homepage header