// @ts-nocheck - drizzle-zod generates types incompatible with zod@3.25+ (v4 internals)
import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  primaryKey,
  varchar,
  unique,
  index,
  customType,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// PostgreSQL bytea (binary) column type
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

// ============================================================
// ENUMS & CONSTANTS
// ============================================================

// Consumer-friendly categorization model
export enum CategorizationModel {
  CONDITION = "condition",
  BODY_SYSTEM = "body_system",
  LIFE_STAGE = "life_stage",
}

// User role enum
export enum UserRole {
  ADMIN = "admin",
  EDITOR = "editor",
  CUSTOMER = "customer",
  VISITOR = "visitor",
}

// ============================================================
// USER & AUTH TABLES (users, sessions, audit, preferences)
// ============================================================

// Users table schema - Enhanced for authentication
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey().notNull(),
    username: varchar("username", { length: 255 }).unique(),
    email: text("email").unique(),
    // Dropped the legacy `password` column in migration 015 — all 19 users
    // had NULL there and auth always read from passwordHash.
    passwordHash: text("passwordHash"),
    // firstName and lastName columns don't exist in the database
    // firstName: text("first_name"),
    // lastName: text("last_name"),
    profileImageUrl: text("profile_image"), // Changed from profile_image_url to match database
    role: text("role").default(UserRole.CUSTOMER),
    permissions: text("permissions").array().default([]),
    isActive: boolean("isActive").default(true), // Changed from is_active to match database
    lastLogin: timestamp("lastLogin"), // Changed from last_login to match database
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      usernameIdx: index("username_idx").on(table.username),
      emailIdx: index("email_idx").on(table.email),
    };
  },
);

// User sessions table for managing active sessions
export const userSessions = pgTable(
  "user_sessions",
  {
    id: text("id").primaryKey(), // Session ID
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    data: text("data"), // Session data (JSON)
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    lastActivity: timestamp("last_activity").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      userIdIdx: index("user_sessions_user_id_idx").on(table.userId),
      expiresIdx: index("user_sessions_expires_idx").on(table.expiresAt),
    };
  },
);

// Audit logs table for tracking user actions
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(), // login, logout, update_profile, etc.
    entityType: text("entity_type"), // user, study, blog, etc.
    entityId: text("entity_id"), // ID of the affected entity
    changes: text("changes"), // JSON with before/after values
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    sessionId: text("session_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
      actionIdx: index("audit_logs_action_idx").on(table.action),
      createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
    };
  },
);

// Password reset tokens table
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      tokenIdx: index("password_reset_token_idx").on(table.token),
      userIdIdx: index("password_reset_user_id_idx").on(table.userId),
    };
  },
);

// User preferences table schema
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categories: text("categories").array().default([]),
  keywords: text("keywords").array().default([]),
  authors: text("authors").array().default([]),
  // Intelligent Preferences
  preferredHealthBenefits: text("preferred_health_benefits").array().default([]),
  preferredHealthConditions: text("preferred_health_conditions").array().default([]),
  preferredBodySystems: text("preferred_body_systems").array().default([]),
  preferredLifeStages: text("preferred_life_stages").array().default([]),
  preferredStudyTypes: text("preferred_study_types").array().default([]),
  preferredReadingLevel: text("preferred_reading_level"),
  excludedTopics: text("excluded_topics").array().default([]),
  emailNotifications: boolean("email_notifications").default(true),
  notificationFrequency: text("notification_frequency").default("weekly"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Search history table schema
export const searchHistory = pgTable("search_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  searchQuery: text("search_query").notNull(),
  searchDate: timestamp("search_date").notNull().defaultNow(),
});

// User study interactions (saved/viewed studies)
export const userStudyInteractions = pgTable(
  "user_study_interactions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studyId: integer("study_id")
      .notNull()
      .references(() => studies.id, { onDelete: "cascade" }),
    isSaved: boolean("is_saved").default(false),
    viewCount: integer("view_count").default(0),
    lastViewed: timestamp("last_viewed").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.userId, table.studyId] }),
      // PK leads with userId, so studyId-only lookups (e.g. FK cleanup on
      // study delete, "who saved this study") need a standalone index.
      studyIdIdx: index("user_study_interactions_study_id_idx").on(table.studyId),
    };
  },
);

// User reading history (Append-only log for recommendations)
export const userReadingHistory = pgTable("user_reading_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  studyId: integer("study_id").notNull().references(() => studies.id, { onDelete: "cascade" }),
  interactionType: text("interaction_type").notNull().default("view"), // view, like, share
  viewedAt: timestamp("viewed_at").notNull().defaultNow(),
});

// Notifications table schema
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").notNull(), // "study", "blog", "system"
    referenceId: integer("reference_id"), // Study or blog ID
    isRead: boolean("is_read").default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      userIdIdx: index("notifications_user_id_idx").on(table.userId),
      userUnreadIdx: index("notifications_user_unread_idx").on(
        table.userId,
        table.isRead,
      ),
    };
  },
);

// User blog interactions (saved/viewed blogs)
export const userBlogInteractions = pgTable(
  "user_blog_interactions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blogId: integer("blog_id")
      .notNull()
      .references(() => blogArticles.id, { onDelete: "cascade" }),
    isSaved: boolean("is_saved").default(false),
    viewCount: integer("view_count").default(0),
    lastViewed: timestamp("last_viewed").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.userId, table.blogId] }),
      // PK leads with userId; blogId-only lookups need a standalone index.
      blogIdIdx: index("user_blog_interactions_blog_id_idx").on(table.blogId),
    };
  },
);

// ============================================================
// STUDY & RESEARCH TABLES (studies, categories, collections)
// ============================================================

// Studies table schema
export const studies = pgTable(
  "studies",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    abstract: text("abstract").notNull(),
    authors: text("authors").notNull(),
    journal: text("journal").notNull(),
    publishDate: text("publish_date").notNull(), // Date when study was added to our site
    journalPublishDate: text("journal_publish_date"), // Original publication date in the journal
    category: text("category").notNull(),
    methods: text("methods"),
    results: text("results"),
    conclusion: text("conclusion"),
    doi: text("doi"),
    url: text("url"),
    pdfUrl: text("pdf_url"),
    citationUrl: text("citation_url"),
    peerReviewed: boolean("peer_reviewed").notNull().default(true),
    // Media fields
    imageUrl: text("image_url"),
    imageAlt: text("image_alt"),
    // Support for multiple images and captions
    images: text("images").array(),
    imageCaptions: text("image_captions").array(),
    videoUrl: text("video_url"),
    audioUrl: text("audio_url"),
    // Automatically generated image information
    autoGeneratedImage: boolean("auto_generated_image").default(false),
    // Standardized summary fields for consistent display
    objective: text("objective"),
    methodsShort: text("methods_short"),
    resultsShort: text("results_short"),
    conclusionShort: text("conclusion_short"),
    summaryMarkdown: text("summary_markdown"),
    // Consumer-friendly categorization
    consumerCategories: text("consumer_categories"),
    // Additional fields for visualizations
    publishYear: integer("publish_year"),
    country: text("country"),
    region: text("region"),
    studyType: text("study_type"), // human, animal, in vitro
    outcome: text("outcome"), // positive, neutral, negative
    sampleSize: integer("sample_size"),
    duration: integer("duration"), // Study duration in days
    hasFullText: boolean("has_full_text").default(false),
    viewCount: integer("view_count").default(0),
    citationCount: integer("citation_count").default(0),
    // Source tracking information
    sourceUrl: text("source_url"),
    sourcePlatform: text("source_platform"),

    // Only include fields that exist in the database
    keywords: text("keywords").array(), // Author-provided keywords
    
    // Intelligent Features (Denormalized for performance)
    healthBenefits: text("health_benefits").array(), 
    healthConditions: text("health_conditions").array(),
    bodySystems: text("body_systems").array(), 
    lifeStages: text("life_stages").array(),
    studyTypes: text("study_types").array(),
    mechanisms: text("mechanisms").array(),
    readingLevel: text("reading_level"),
    tags: text("tags").array(),
    enhancedWithAI: boolean("enhanced_with_ai").default(false),
    popularityScore: integer("popularity_score").default(0),

    plainLanguageTitle: text("plain_language_title"), // SEO-optimized consumer-friendly title
    slug: text("slug"), // URL-friendly slug generated from plain language title

    // Authentic research data fields from PubMed/CrossRef APIs
    authorAffiliations: text("author_affiliations"), // Real institutional affiliations
    fundingSources: text("funding_sources"), // Actual grant information
    statisticalMethods: text("statistical_methods"), // Research methodology details
    ethicalApproval: text("ethical_approval"), // Ethics committee information
    fullText: text("full_text"), // Full research paper content when available

    // SEO Enhancement Fields
    canonicalUrl: text("canonical_url"), // Prevent duplicate content issues
    metaTitle: text("meta_title"), // SEO-optimized title (60 chars)
    metaDescription: text("meta_description"), // SEO description (160 chars)
    schemaOrg: text("schema_org"), // JSON-LD structured data for search engines
    ogTitle: text("og_title"), // Open Graph title for social sharing
    ogDescription: text("og_description"), // Open Graph description
    ogImage: text("og_image"), // Open Graph image URL
    twitterCard: text("twitter_card"), // Twitter card type
    twitterTitle: text("twitter_title"), // Twitter card title
    twitterDescription: text("twitter_description"), // Twitter card description
    twitterImage: text("twitter_image"), // Twitter card image
    lastModified: timestamp("last_modified"), // For sitemap generation
    priority: text("priority"), // Sitemap priority (0.0-1.0)
    changeFrequency: text("change_frequency"), // Sitemap update frequency
    structuredData: text("structured_data"), // JSONB field for AI-readable structured data

    // Academic Enhancement Fields
    academicSchema: text("academic_schema"), // Scholar.org structured data
    citationFormats: text("citation_formats"), // JSON with multiple citation formats (APA, MLA, etc.)
    impactMetrics: text("impact_metrics"), // Academic ranking and impact scores
    peerReviewStatus: text("peer_review_status"), // Peer review credibility status
    conflictOfInterest: text("conflict_of_interest"), // Trust signal declarations

    // AI Comprehension Fields
    hierarchicalStructure: text("hierarchical_structure"), // H1, H2, H3 tag structure
    semanticHtml: text("semantic_html"), // Semantic HTML equivalents
    entityRecognition: text("entity_recognition"), // JSON of recognized entities (people, places, medical terms)
    conceptRelationships: text("concept_relationships"), // Linked data relationships
    questionAnswerPairs: text("question_answer_pairs"), // Q&A pairs for AI training
    summary50Words: text("summary_50_words"), // 50-word summary
    summary100Words: text("summary_100_words"), // 100-word summary
    summary200Words: text("summary_200_words"), // 200-word summary
    semanticKeywords: text("semantic_keywords").array(), // LSI keywords for SEO
    topicalRelevance: integer("topical_relevance"), // Score for topical authority (0-100)

    // TLDR and practical application fields
    tldr: text("tldr"), // AI-generated super-simplified summary
    howToApply: text("how_to_apply"), // Study-specific practical application guidance (JSON)

    // Consumer-facing study content (for Shopify App Proxy research database)
    plainSummary: text("plain_summary"), // Plain-language summary for non-scientists
    keyFinding: text("key_finding"), // 1-2 sentence headline result
    practicalTakeaway: text("practical_takeaway"), // What this means for the reader

    // H2-specific research metadata (for Shopify App Proxy research database)
    h2DeliveryMethod: text("h2_delivery_method"), // drinking, inhalation, bathing, injection
    h2Concentration: varchar("h2_concentration", { length: 100 }),
    dosageProtocol: text("dosage_protocol"),
    methodologySummary: text("methodology_summary"),
    limitations: text("limitations"),
    isHumanTrial: boolean("is_human_trial").default(false),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      // Performance indexes for SEO and search
      slugIdx: index("studies_slug_idx").on(table.slug),
      canonicalUrlIdx: index("studies_canonical_url_idx").on(
        table.canonicalUrl,
      ),
      publishYearIdx: index("studies_publish_year_idx").on(table.publishYear),
      categoryIdx: index("studies_category_idx").on(table.category),
      viewCountIdx: index("studies_view_count_idx").on(table.viewCount),
      lastModifiedIdx: index("studies_last_modified_idx").on(
        table.lastModified,
      ),
      // Additional performance indexes for filtered queries
      countryIdx: index("studies_country_idx").on(table.country),
      peerReviewedIdx: index("studies_peer_reviewed_idx").on(table.peerReviewed),
      studyTypeIdx: index("studies_study_type_idx").on(table.studyType),
      publishDateIdx: index("studies_publish_date_idx").on(table.publishDate),
    };
  },
);

// Deleted studies ledger — tracks studies that were intentionally removed
// so they are not accidentally re-imported and admins can see deletion history
export const deletedStudies = pgTable(
  "deleted_studies",
  {
    id: serial("id").primaryKey(),
    originalStudyId: integer("original_study_id").notNull(),
    title: text("title").notNull(),
    doi: text("doi"),
    authors: text("authors"),
    journal: text("journal"),
    publishYear: integer("publish_year"),
    deletedBy: text("deleted_by"),
    reason: text("reason"),
    deletedAt: timestamp("deleted_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      doiIdx: index("deleted_studies_doi_idx").on(table.doi),
      titleIdx: index("deleted_studies_title_idx").on(table.title),
    };
  },
);

// Content generation queue — unified pipeline for post-import enrichment
export const contentGenerationQueue = pgTable("content_generation_queue", {
  id: serial("id").primaryKey(),
  studyId: integer("study_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  currentStep: text("current_step"), // seo, tags, blogs, image, links
  completedSteps: text("completed_steps").array().default([]),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  priority: integer("priority").notNull().default(0), // higher = sooner
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  statusIdx: index("cgq_status_idx").on(table.status),
  studyIdIdx: index("cgq_study_id_idx").on(table.studyId),
}));

// Categories table schema
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  icon: text("icon"),
  studyCount: integer("study_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Study categories junction table for many-to-many relationships
export const studyCategories = pgTable(
  "study_categories",
  {
    id: serial("id").primaryKey(),
    studyId: integer("study_id")
      .notNull()
      .references(() => studies.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      studyIdIdx: index("study_categories_study_id_idx").on(table.studyId),
      categoryIdIdx: index("study_categories_category_id_idx").on(
        table.categoryId,
      ),
    };
  },
);

// Body systems table schema
export const bodySystems = pgTable("body_systems", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  icon: text("icon"),
  slug: text("slug").notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Health conditions table schema
export const healthConditions = pgTable("health_conditions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  bodySystemId: integer("body_system_id")
    .notNull()
    .references(() => bodySystems.id, { onDelete: "restrict" }),
  slug: text("slug").notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
  studyCount: integer("study_count").notNull().default(0),
  // Shopify App Proxy research database fields
  mechanismSummary: text("mechanism_summary"),
  primaryProduct: varchar("primary_product", { length: 50 }),
  confidenceLevel: varchar("confidence_level", { length: 20 }),
  humanTrialCount: integer("human_trial_count").default(0),
  searchVolumeEstimate: integer("search_volume_estimate"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Study health conditions mapping table
export const studyHealthConditions = pgTable(
  "study_health_conditions",
  {
    studyId: integer("study_id")
      .notNull()
      .references(() => studies.id, { onDelete: "cascade" }),
    healthConditionId: integer("health_condition_id")
      .notNull()
      .references(() => healthConditions.id, { onDelete: "cascade" }),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.studyId, table.healthConditionId] }),
      // PK leads with studyId; queries filtering only by healthConditionId
      // (e.g. "studies for this condition") need their own index.
      healthConditionIdIdx: index(
        "study_health_conditions_health_condition_id_idx",
      ).on(table.healthConditionId),
    };
  },
);

// Curated collections table
export const studyCollections = pgTable("study_collections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  slug: text("slug").notNull().unique(),
  imageUrl: text("image_url"),
  imageAlt: text("image_alt"),
  featuredOrder: integer("featured_order").default(0),
  isPublished: boolean("is_published").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Consumer categories table for categorization system
export const consumerCategories = pgTable("consumer_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  categoryModel: text("category_model").notNull(), // 'condition', 'body_system', 'life_stage'
  slug: text("slug").notNull().unique(),
  studyCount: integer("study_count").default(0),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Collection studies mapping table
export const collectionStudies = pgTable(
  "collection_studies",
  {
    collectionId: integer("collection_id")
      .notNull()
      .references(() => studyCollections.id, { onDelete: "cascade" }),
    studyId: integer("study_id")
      .notNull()
      .references(() => studies.id, { onDelete: "cascade" }),
    displayOrder: integer("display_order").default(0),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.collectionId, table.studyId] }),
    };
  },
);

// ============================================================
// CONTENT & COMMUNICATION TABLES (newsletters, blogs, FAQ, etc.)
// ============================================================

// Newsletter subscriptions table schema
export const newsletters = pgTable("newsletters", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Educational resources table - for Learn section
export const educationalResources = pgTable("educational_resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  contentMarkdown: text("content_markdown").notNull(),
  resourceType: text("resource_type").notNull(), // glossary, faq, tutorial, guide
  featuredOrder: integer("featured_order").default(0),
  viewCount: integer("view_count").default(0),
  isPublished: boolean("is_published").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Glossary terms table
export const glossaryTerms = pgTable("glossary_terms", {
  id: serial("id").primaryKey(),
  term: text("term").notNull().unique(),
  definition: text("definition").notNull(),
  longDefinition: text("long_definition"),
  references: text("references"),
  relatedTerms: text("related_terms").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// FAQ table
export const faqItems = pgTable("faq_items", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  answerMarkdown: text("answer_markdown").notNull(),
  category: text("category").notNull(), // general, scientific, application
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Contact form messages table schema
export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================
// SEO & ANALYTICS TABLES (metadata, keyword tracking, smart links)
// ============================================================

// SEO Metadata table for centralized SEO management
export const seoMetadata = pgTable(
  "seo_metadata",
  {
    id: serial("id").primaryKey(),
    entityType: text("entity_type").notNull(), // 'study', 'blog', 'article', 'page'
    entityId: integer("entity_id").notNull(), // Foreign key to respective table

    // SEO Directives
    robots: text("robots").default("index, follow"), // Index/follow directives
    robotsNoIndex: boolean("robots_no_index").default(false),
    robotsNoFollow: boolean("robots_no_follow").default(false),

    // International SEO
    alternateLanguages: text("alternate_languages"), // JSON array of hreflang tags

    // Link Management
    internalLinks: text("internal_links").array(), // Array of related content URLs
    externalLinks: text("external_links").array(), // Authoritative source URLs

    // Keyword and Relevance
    semanticKeywords: text("semantic_keywords").array(), // LSI keywords for SEO
    topicalRelevance: integer("topical_relevance").default(50), // Score 0-100 for topical authority
    keywordDensity: text("keyword_density"), // JSON object with keyword frequency data

    // Search Engine Performance
    clickThroughRate: text("click_through_rate"), // CTR data from search console
    averagePosition: text("average_position"), // Average SERP position
    impressions: integer("impressions").default(0), // Search impressions count
    clicks: integer("clicks").default(0), // Search clicks count

    // AI and ML Optimization
    aiOptimizationScore: integer("ai_optimization_score").default(0), // 0-100 score
    contentQualityScore: integer("content_quality_score").default(0), // 0-100 score
    readabilityScore: integer("readability_score").default(0), // 0-100 score
    sentimentAnalysis: text("sentiment_analysis"), // JSON with sentiment data

    // Schema Markup
    richSnippetType: text("rich_snippet_type"), // Type of rich snippet (FAQ, HowTo, etc.)
    schemaMarkup: text("schema_markup"), // Full schema.org JSON-LD

    // Social Media Metrics
    socialMediaEngagement: text("social_media_engagement"), // JSON with platform-specific metrics
    viralityScore: integer("virality_score").default(0), // 0-100 viral potential

    // Content Freshness
    lastContentUpdate: timestamp("last_content_update"),
    contentUpdateFrequency: text("content_update_frequency"), // daily, weekly, monthly, yearly
    nextScheduledUpdate: timestamp("next_scheduled_update"),

    // Performance Metrics
    pageSpeed: integer("page_speed"), // Lighthouse score
    mobileFriendly: boolean("mobile_friendly").default(true),
    coreWebVitals: text("core_web_vitals"), // JSON with LCP, FID, CLS scores

    // Tracking
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      // Composite index for entity lookups
      entityIdx: index("seo_metadata_entity_idx").on(
        table.entityType,
        table.entityId,
      ),
      // Performance indexes
      relevanceIdx: index("seo_metadata_relevance_idx").on(
        table.topicalRelevance,
      ),
      qualityIdx: index("seo_metadata_quality_idx").on(
        table.contentQualityScore,
      ),
    };
  },
);

// Table for tracking scraped sources to avoid duplicates
export const scrapedSources = pgTable("scraped_sources", {
  id: serial("id").primaryKey(),
  sourceUrl: text("source_url").notNull(),
  sourcePlatform: text("source_platform").notNull(),
  studyId: integer("study_id")
    .notNull()
    .references(() => studies.id, { onDelete: "cascade" }),
  scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
});

// Study review status enum values
export const ReviewStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

// Study review queue table for managing the study approval process
export const studyReviewQueue = pgTable(
  "study_review_queue",
  {
    id: serial("id").primaryKey(),
    // External study ID (from source database like PubMed, CrossRef, etc.)
    externalId: text("external_id").notNull(),
    // DOI for duplicate checking
    doi: text("doi"),
    title: text("title").notNull(),
    abstract: text("abstract").notNull(),
    authors: text("authors").notNull(),
    journal: text("journal").notNull(),
    publishDate: text("publish_date"),
    journalPublishDate: text("journal_publish_date"),
    category: text("category").notNull(),
    // Source information
    sourceUrl: text("source_url"),
    sourcePlatform: text("source_platform").notNull(),
    // Review status
    status: text("status").notNull().default("pending"),
    // Who saved the study for review and who approved/rejected it
    savedByUserId: text("saved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    // Notes added during the review process
    reviewNotes: text("review_notes"),
    // Whether this entry is a duplicate of an existing study
    isDuplicate: boolean("is_duplicate").default(false),
    // If it's a duplicate, this references the original study
    duplicateOfStudyId: integer("duplicate_of_study_id").references(
      () => studies.id,
      { onDelete: "set null" },
    ),
    // Timestamps
    savedAt: timestamp("saved_at").notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      statusIdx: index("study_review_queue_status_idx").on(table.status),
      doiIdx: index("study_review_queue_doi_idx").on(table.doi),
      savedByIdx: index("study_review_queue_saved_by_idx").on(
        table.savedByUserId,
      ),
      reviewedByIdx: index("study_review_queue_reviewed_by_idx").on(
        table.reviewedByUserId,
      ),
      duplicateOfIdx: index("study_review_queue_duplicate_of_idx").on(
        table.duplicateOfStudyId,
      ),
    };
  },
);

// Multi-format content table for generated content in various formats
export const multiFormatContent = pgTable(
  "multi_format_content",
  {
    id: serial("id").primaryKey(),
    studyId: integer("study_id")
      .notNull()
      .references(() => studies.id, { onDelete: "cascade" }),
    formatType: text("format_type").notNull(), // podcast, infographic, social_twitter, social_linkedin, video, newsletter
    title: text("title").notNull(),

    // Podcast fields
    podcastScript: text("podcast_script"),
    podcastIntro: text("podcast_intro"),
    podcastOutro: text("podcast_outro"),
    podcastQA: text("podcast_qa"), // JSON array of Q&A pairs
    podcastShowNotes: text("podcast_show_notes"),
    podcastDuration: integer("podcast_duration"), // in seconds

    // Infographic fields
    keyStatistics: text("key_statistics"), // JSON array of stats
    dataPoints: text("data_points"), // JSON for charts and graphs
    visualSuggestions: text("visual_suggestions"), // JSON for design guidance
    infographicTitle: text("infographic_title"),
    infographicSubheadings: text("infographic_subheadings"), // JSON array

    // Social media fields
    socialPlatform: text("social_platform"), // twitter, linkedin, instagram, facebook, tiktok
    socialContent: text("social_content"),
    hashtags: text("hashtags").array(),
    threadContent: text("thread_content"), // JSON array for Twitter threads
    characterCount: integer("character_count"),

    // Video script fields
    videoScript: text("video_script"),
    videoType: text("video_type"), // youtube_explainer, short_form, animation
    videoStoryboard: text("video_storyboard"), // JSON with scenes and timing
    videoDuration: integer("video_duration"), // in seconds
    visualCues: text("visual_cues"), // JSON array of visual directions

    // Newsletter fields
    newsletterHtml: text("newsletter_html"),
    newsletterPlainText: text("newsletter_plain_text"),
    newsletterSubjectLine: text("newsletter_subject_line"),
    newsletterPreheader: text("newsletter_preheader"),

    // Common fields
    readingLevel: text("reading_level").default("6th_grade"),
    wordCount: integer("word_count"),
    isPublished: boolean("is_published").default(false),
    publishedAt: timestamp("published_at"),
    scheduledFor: timestamp("scheduled_for"),

    // Performance metrics
    viewCount: integer("view_count").default(0),
    engagementScore: integer("engagement_score").default(0),
    shareCount: integer("share_count").default(0),
    clickThroughRate: text("click_through_rate"),
    conversionMetrics: text("conversion_metrics"), // JSON with platform-specific metrics

    // SEO and meta fields
    metaDescription: text("meta_description"),
    keywords: text("keywords").array(),
    ogImage: text("og_image"),

    // Generation metadata
    generatedBy: text("generated_by").default("ai"), // ai, manual, hybrid
    generationModel: text("generation_model"),
    generationPrompt: text("generation_prompt"),
    editorNotes: text("editor_notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      // Indexes for performance
      studyIdIdx: index("multi_format_content_study_id_idx").on(table.studyId),
      formatTypeIdx: index("multi_format_content_format_type_idx").on(
        table.formatType,
      ),
      publishedIdx: index("multi_format_content_published_idx").on(
        table.isPublished,
      ),
      scheduledIdx: index("multi_format_content_scheduled_idx").on(
        table.scheduledFor,
      ),
    };
  },
);

// Blog articles table schema
export const blogArticles = pgTable(
  "blog_articles",
  {
    id: serial("id").primaryKey(),
    studyId: integer("study_id")
      .notNull()
      .references(() => studies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    summary: text("summary").notNull(),
    content: text("content").notNull(),
    quickInsights: text("quick_insights"),
    imageUrl: text("image_url"),
    imageAlt: text("image_alt"),
    images: text("images").array(), // Support for multiple generated images
    readingLevel: text("reading_level").default("general"),
    articleType: text("article_type"),
    isPublished: boolean("is_published").default(false),
    editorNotes: text("editor_notes"),
    viewCount: integer("view_count").default(0),

    // SEO Enhancement Fields for Blogs
    canonicalUrl: text("canonical_url"),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    schemaOrg: text("schema_org"), // Article schema JSON-LD
    breadcrumbs: text("breadcrumbs"), // Navigation structure JSON
    authorBio: text("author_bio"), // For E-A-T (Expertise, Authority, Trust)
    lastReviewed: timestamp("last_reviewed"), // Content freshness indicator
    faqSchema: text("faq_schema"), // FAQ structured data if applicable
    socialShares: integer("social_shares").default(0), // Track social engagement
    ogTitle: text("og_title"),
    ogDescription: text("og_description"),
    ogImage: text("og_image"),
    twitterCard: text("twitter_card"),
    twitterTitle: text("twitter_title"),
    twitterDescription: text("twitter_description"),

    // AI Comprehension Fields for Blogs
    hierarchicalStructure: text("hierarchical_structure"),
    entityRecognition: text("entity_recognition"),
    semanticKeywords: text("semantic_keywords").array(),
    questionAnswerPairs: text("question_answer_pairs"),
    summary50Words: text("summary_50_words"),
    summary100Words: text("summary_100_words"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      // Performance indexes for blog SEO
      slugIdx: index("blog_articles_slug_idx").on(table.slug),
      canonicalUrlIdx: index("blog_articles_canonical_url_idx").on(
        table.canonicalUrl,
      ),
      publishedIdx: index("blog_articles_published_idx").on(table.isPublished),
      viewCountIdx: index("blog_articles_view_count_idx").on(table.viewCount),
      // FK index — needed for study-delete cascade and study→blog joins.
      studyIdIdx: index("blog_articles_study_id_idx").on(table.studyId),
    };
  },
);

// Create insertion schemas and types
export const insertStudySchema = createInsertSchema(studies).omit({
  id: true,
  createdAt: true,
  lastModified: true,
});
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});
export const insertNewsletterSchema = createInsertSchema(newsletters).omit({
  id: true,
  createdAt: true,
});
export const insertContactSchema = createInsertSchema(contactMessages).omit({
  id: true,
  createdAt: true,
});
export const insertBlogArticleSchema = createInsertSchema(blogArticles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
});
export const insertMultiFormatContentSchema = createInsertSchema(
  multiFormatContent,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
  engagementScore: true,
  shareCount: true,
});
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertUserPreferencesSchema = createInsertSchema(
  userPreferences,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit(
  { id: true, searchDate: true },
);
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});
export const insertUserStudyInteractionSchema = createInsertSchema(
  userStudyInteractions,
).omit({ createdAt: true });
export const insertUserBlogInteractionSchema = createInsertSchema(
  userBlogInteractions,
).omit({ createdAt: true });
export const insertEducationalResourceSchema = createInsertSchema(
  educationalResources,
).omit({ id: true, createdAt: true, updatedAt: true, viewCount: true });
export const insertGlossaryTermSchema = createInsertSchema(glossaryTerms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertFaqItemSchema = createInsertSchema(faqItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertStudyCollectionSchema = createInsertSchema(
  studyCollections,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCollectionStudySchema = createInsertSchema(
  collectionStudies,
).omit({ addedAt: true });
export const insertStudyReviewQueueSchema = createInsertSchema(
  studyReviewQueue,
).omit({
  id: true,
  savedAt: true,
  reviewedAt: true,
  createdAt: true,
});
export const insertSeoMetadataSchema = createInsertSchema(seoMetadata).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for insertion
export type InsertStudy = z.infer<typeof insertStudySchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertNewsletter = z.infer<typeof insertNewsletterSchema>;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type InsertBlogArticle = z.infer<typeof insertBlogArticleSchema>;
export type InsertMultiFormatContent = z.infer<
  typeof insertMultiFormatContentSchema
>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type InsertUserStudyInteraction = z.infer<
  typeof insertUserStudyInteractionSchema
>;
export type InsertUserBlogInteraction = z.infer<
  typeof insertUserBlogInteractionSchema
>;
export type InsertEducationalResource = z.infer<
  typeof insertEducationalResourceSchema
>;
export type InsertGlossaryTerm = z.infer<typeof insertGlossaryTermSchema>;
export type InsertFaqItem = z.infer<typeof insertFaqItemSchema>;
export type InsertStudyCollection = z.infer<typeof insertStudyCollectionSchema>;
export type InsertCollectionStudy = z.infer<typeof insertCollectionStudySchema>;
export type InsertStudyReviewQueue = z.infer<
  typeof insertStudyReviewQueueSchema
>;
export type InsertSeoMetadata = z.infer<typeof insertSeoMetadataSchema>;

// Types for selection
export type Study = typeof studies.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Newsletter = typeof newsletters.$inferSelect;
export type BlogArticle = typeof blogArticles.$inferSelect;
export type MultiFormatContent = typeof multiFormatContent.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type UserStudyInteraction = typeof userStudyInteractions.$inferSelect;
export type UserBlogInteraction = typeof userBlogInteractions.$inferSelect;
export type EducationalResource = typeof educationalResources.$inferSelect;
export type GlossaryTerm = typeof glossaryTerms.$inferSelect;
export type FaqItem = typeof faqItems.$inferSelect;
export type StudyCollection = typeof studyCollections.$inferSelect;
export type CollectionStudy = typeof collectionStudies.$inferSelect;
export type StudyReviewQueue = typeof studyReviewQueue.$inferSelect;
export type SeoMetadata = typeof seoMetadata.$inferSelect;

// Chat conversations table schema
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").default("New Conversation"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Chat messages table schema
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Chat feedback table schema
export const chatFeedback = pgTable("chat_feedback", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id")
    .notNull()
    .references(() => chatMessages.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  rating: integer("rating").notNull(), // 1 (thumbs down) or 5 (thumbs up)
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Popular questions table schema
export const popularQuestions = pgTable("popular_questions", {
  id: serial("id").primaryKey(),
  question: text("question").notNull().unique(),
  category: text("category").notNull(),
  displayOrder: integer("display_order").default(0),
  clickCount: integer("click_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Create insertion schemas for chat tables
export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});
export const insertChatFeedbackSchema = createInsertSchema(chatFeedback).omit({
  id: true,
  createdAt: true,
});
export const insertPopularQuestionSchema = createInsertSchema(
  popularQuestions,
).omit({ id: true, clickCount: true, createdAt: true });

// Types for chat tables
export type Conversation = typeof conversations.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type ChatFeedback = typeof chatFeedback.$inferSelect;
export type PopularQuestion = typeof popularQuestions.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type InsertChatFeedback = z.infer<typeof insertChatFeedbackSchema>;
export type InsertPopularQuestion = z.infer<typeof insertPopularQuestionSchema>;

// Keyword monitoring tables
export const keywords = pgTable("keywords", {
  id: serial("id").primaryKey(),
  term: text("term").notNull(),
  category: text("category").default("general").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastSearched: timestamp("last_searched"),
  matchCount: integer("match_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const excludedKeywords = pgTable("excluded_keywords", {
  id: serial("id").primaryKey(),
  term: text("term").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const keywordGroups = pgTable("keyword_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const keywordGroupMappings = pgTable("keyword_group_mappings", {
  id: serial("id").primaryKey(),
  keywordId: integer("keyword_id")
    .references(() => keywords.id, { onDelete: "cascade" })
    .notNull(),
  groupId: integer("group_id")
    .references(() => keywordGroups.id, { onDelete: "cascade" })
    .notNull(),
});

export const monitorSchedule = pgTable("monitor_schedule", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  frequency: text("frequency").default("daily").notNull(),
  time: text("time").default("00:00").notNull(),
  days: text("days").array(),
  sources: text("sources").array(),
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const monitorResults = pgTable("monitor_results", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  abstract: text("abstract"),
  authors: text("authors"),
  journal: text("journal"),
  publishDate: text("publish_date"),
  doi: text("doi"),
  url: text("url"),
  matchedKeywords: text("matched_keywords").array(),
  status: text("status").default("pending").notNull(),
  source: text("source").notNull(),
  foundAt: timestamp("found_at").defaultNow().notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  notes: text("notes"),
});

// Create insertion schemas for keyword monitoring
export const insertKeywordSchema = createInsertSchema(keywords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSearched: true,
  matchCount: true,
});
export const insertExcludedKeywordSchema = createInsertSchema(
  excludedKeywords,
).omit({ id: true, createdAt: true });
export const insertKeywordGroupSchema = createInsertSchema(keywordGroups).omit({
  id: true,
  createdAt: true,
});
export const insertKeywordGroupMappingSchema = createInsertSchema(
  keywordGroupMappings,
).omit({ id: true });
export const insertMonitorResultSchema = createInsertSchema(
  monitorResults,
).omit({
  id: true,
  foundAt: true,
  reviewedAt: true,
});
export const insertMonitorScheduleSchema = createInsertSchema(
  monitorSchedule,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRun: true,
  nextRun: true,
});

// Types for keyword monitoring
export type Keyword = typeof keywords.$inferSelect;
export type ExcludedKeyword = typeof excludedKeywords.$inferSelect;
export type KeywordGroup = typeof keywordGroups.$inferSelect;
export type KeywordGroupMapping = typeof keywordGroupMappings.$inferSelect;
export type MonitorSchedule = typeof monitorSchedule.$inferSelect;
export type MonitorResult = typeof monitorResults.$inferSelect;
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type InsertExcludedKeyword = z.infer<typeof insertExcludedKeywordSchema>;
export type InsertKeywordGroup = z.infer<typeof insertKeywordGroupSchema>;
export type InsertKeywordGroupMapping = z.infer<
  typeof insertKeywordGroupMappingSchema
>;
export type InsertMonitorSchedule = z.infer<typeof insertMonitorScheduleSchema>;
export type InsertMonitorResult = z.infer<typeof insertMonitorResultSchema>;

// ===== AUTOMATED TAGGING SYSTEM =====

// Tags table - stores all available tags
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  category: text("category").notNull(), // health_condition, body_system, methodology, outcome, etc.
  color: text("color"), // For UI display
  usageCount: integer("usage_count").default(0),
  isSystemGenerated: boolean("is_system_generated").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Study-tag relationships (many-to-many)
export const studyTags = pgTable(
  "study_tags",
  {
    id: serial("id").primaryKey(),
    studyId: integer("study_id")
      .references(() => studies.id, { onDelete: "cascade" })
      .notNull(),
    tagId: integer("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
    confidence: integer("confidence").default(100), // AI confidence score 0-100
    source: text("source").notNull(), // 'title', 'abstract', 'keywords', 'content', 'manual'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      uniqueStudyTag: unique().on(table.studyId, table.tagId),
      studyIdx: index("study_tags_study_idx").on(table.studyId),
      tagIdx: index("study_tags_tag_idx").on(table.tagId),
    };
  },
);

// Tag categories for organization
export const tagCategories = pgTable("tag_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  color: text("color"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tag synonyms for better matching
export const tagSynonyms = pgTable(
  "tag_synonyms",
  {
    id: serial("id").primaryKey(),
    tagId: integer("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
    synonym: text("synonym").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      uniqueSynonym: unique().on(table.tagId, table.synonym),
    };
  },
);

// Create insertion schemas for tagging system
export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});
export const insertStudyTagSchema = createInsertSchema(studyTags).omit({
  id: true,
  createdAt: true,
});
export const insertTagCategorySchema = createInsertSchema(tagCategories).omit({
  id: true,
  createdAt: true,
});
export const insertTagSynonymSchema = createInsertSchema(tagSynonyms).omit({
  id: true,
  createdAt: true,
});

// Types for tagging system
export type Tag = typeof tags.$inferSelect;
export type StudyTag = typeof studyTags.$inferSelect;
export type TagCategory = typeof tagCategories.$inferSelect;
export type TagSynonym = typeof tagSynonyms.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type InsertStudyTag = z.infer<typeof insertStudyTagSchema>;
export type InsertTagCategory = z.infer<typeof insertTagCategorySchema>;
export type InsertTagSynonym = z.infer<typeof insertTagSynonymSchema>;

// ===== SCIENTIFIC ARTICLES TABLE =====
// For longer, more detailed scientific content

export const scientificArticles = pgTable("scientific_articles", {
  id: serial("id").primaryKey(),
  studyId: integer("study_id")
    .notNull()
    .references(() => studies.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  articleType: text("article_type").notNull(), // 'comprehensive_review', 'clinical_applications'
  content: text("content").notNull(), // 2000-3000 words of detailed content
  summary: text("summary").notNull(), // Executive summary
  abstract: text("abstract"), // Formal scientific abstract
  introduction: text("introduction"), // Detailed introduction section
  methodology: text("methodology"), // Methodology analysis
  results: text("results"), // Results discussion
  discussion: text("discussion"), // In-depth discussion
  conclusion: text("conclusion"), // Scientific conclusion
  references: text("references").array(), // List of references/citations
  keywords: text("keywords").array(), // Scientific keywords for indexing
  authors: text("authors"), // Article authors (can differ from study authors)
  readingLevel: text("reading_level").default("8th-10th grade"), // Target reading level
  wordCount: integer("word_count").notNull(),
  readingTime: integer("reading_time").notNull(), // Estimated reading time in minutes

  // SEO fields
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  canonicalUrl: text("canonical_url"),

  // Media fields
  imageUrl: text("image_url"),
  imageAlt: text("image_alt"),
  figures: text("figures").array(), // Scientific figures/charts
  figuresCaptions: text("figures_captions").array(),

  // Publishing fields
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  viewCount: integer("view_count").default(0),

  // Quality and review
  peerReviewed: boolean("peer_reviewed").default(false),
  reviewedBy: text("reviewed_by"),
  reviewNotes: text("review_notes"),
  qualityScore: integer("quality_score"), // 0-100 quality score

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Create insertion schema for scientific articles
export const insertScientificArticleSchema = createInsertSchema(
  scientificArticles,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
  publishedAt: true,
});

// Types for scientific articles
export type ScientificArticle = typeof scientificArticles.$inferSelect;
export type InsertScientificArticle = z.infer<
  typeof insertScientificArticleSchema
>;

// ===== TREND ANALYSIS TABLES =====

// Search queries table to track what users are searching for
export const searchQueries = pgTable(
  "search_queries",
  {
    id: serial("id").primaryKey(),
    query: text("query").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    resultsCount: integer("results_count").default(0),
    clickedResults: text("clicked_results").array(), // Study IDs that were clicked
    sessionId: text("session_id"),
    searchType: text("search_type"), // 'basic', 'advanced', 'filter'
    filters: text("filters"), // JSON string of applied filters
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      queryIdx: index("search_queries_query_idx").on(table.query),
      createdAtIdx: index("search_queries_created_at_idx").on(table.createdAt),
    };
  },
);

// Study metrics table for tracking engagement
export const studyMetrics = pgTable(
  "study_metrics",
  {
    id: serial("id").primaryKey(),
    studyId: integer("study_id")
      .notNull()
      .references(() => studies.id, { onDelete: "cascade" }),
    date: timestamp("date").notNull(),
    viewCount: integer("view_count").default(0),
    uniqueViewers: integer("unique_viewers").default(0),
    downloadCount: integer("download_count").default(0),
    shareCount: integer("share_count").default(0),
    citationClicks: integer("citation_clicks").default(0),
    avgTimeOnPage: integer("avg_time_on_page"), // in seconds
    bounceRate: integer("bounce_rate"), // percentage
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      studyDateIdx: index("study_metrics_study_date_idx").on(
        table.studyId,
        table.date,
      ),
      dateIdx: index("study_metrics_date_idx").on(table.date),
    };
  },
);

// Trend analysis table to store analysis results
export const trendAnalysis = pgTable(
  "trend_analysis",
  {
    id: serial("id").primaryKey(),
    analysisType: text("analysis_type").notNull(), // 'emerging_topics', 'breakthrough', 'momentum', 'comprehensive'
    periodType: text("period_type").notNull(), // 'weekly', 'monthly', 'quarterly', 'yearly'
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),

    // Analysis results (stored as JSON)
    emergingTopics: text("emerging_topics"), // JSON array of {topic, count, growth_rate, studies}
    breakthroughStudies: text("breakthrough_studies"), // JSON array of study IDs with impact scores
    momentumData: text("momentum_data"), // JSON object with accelerating/declining areas
    keywordTrends: text("keyword_trends"), // JSON object with keyword frequency changes
    citationPatterns: text("citation_patterns"), // JSON object with citation network data

    // Summary and insights
    summary: text("summary"), // AI-generated summary of the analysis
    insights: text("insights").array(), // Key insights from the analysis
    recommendations: text("recommendations").array(), // Actionable recommendations

    // Metrics
    totalStudiesAnalyzed: integer("total_studies_analyzed").default(0),
    newStudiesCount: integer("new_studies_count").default(0),
    avgCitationCount: integer("avg_citation_count").default(0),
    topResearchAreas: text("top_research_areas").array(),

    // Status and metadata
    status: text("status").default("pending"), // 'pending', 'processing', 'completed', 'failed'
    processingTime: integer("processing_time"), // in milliseconds
    errorMessage: text("error_message"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => {
    return {
      typeIdx: index("trend_analysis_type_idx").on(table.analysisType),
      periodIdx: index("trend_analysis_period_idx").on(
        table.periodStart,
        table.periodEnd,
      ),
      statusIdx: index("trend_analysis_status_idx").on(table.status),
    };
  },
);

// Trend alerts table for notifications
export const trendAlerts = pgTable(
  "trend_alerts",
  {
    id: serial("id").primaryKey(),
    trendAnalysisId: integer("trend_analysis_id").references(
      () => trendAnalysis.id,
      { onDelete: "cascade" },
    ),
    alertType: text("alert_type").notNull(), // 'breakthrough', 'emerging_topic', 'momentum_shift'
    alertLevel: text("alert_level").notNull(), // 'info', 'warning', 'critical'
    title: text("title").notNull(),
    message: text("message").notNull(),
    relatedStudies: text("related_studies").array(), // Study IDs
    actionRequired: boolean("action_required").default(false),
    notificationSent: boolean("notification_sent").default(false),
    acknowledgedBy: text("acknowledged_by").references(() => users.id, { onDelete: "set null" }),
    acknowledgedAt: timestamp("acknowledged_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      alertTypeIdx: index("trend_alerts_type_idx").on(table.alertType),
      levelIdx: index("trend_alerts_level_idx").on(table.alertLevel),
      notificationIdx: index("trend_alerts_notification_idx").on(
        table.notificationSent,
      ),
    };
  },
);

// Create insertion schemas for trend analysis
export const insertSearchQuerySchema = createInsertSchema(searchQueries).omit({
  id: true,
  createdAt: true,
});
export const insertStudyMetricsSchema = createInsertSchema(studyMetrics).omit({
  id: true,
  createdAt: true,
});
export const insertTrendAnalysisSchema = createInsertSchema(trendAnalysis).omit(
  {
    id: true,
    createdAt: true,
    completedAt: true,
    processingTime: true,
  },
);
export const insertTrendAlertSchema = createInsertSchema(trendAlerts).omit({
  id: true,
  createdAt: true,
  acknowledgedAt: true,
});

// Types for trend analysis
export type SearchQuery = typeof searchQueries.$inferSelect;
export type StudyMetric = typeof studyMetrics.$inferSelect;
export type TrendAnalysis = typeof trendAnalysis.$inferSelect;
export type TrendAlert = typeof trendAlerts.$inferSelect;
export type InsertSearchQuery = z.infer<typeof insertSearchQuerySchema>;
export type InsertStudyMetrics = z.infer<typeof insertStudyMetricsSchema>;
export type InsertTrendAnalysis = z.infer<typeof insertTrendAnalysisSchema>;
export type InsertTrendAlert = z.infer<typeof insertTrendAlertSchema>;

// ===== CONTENT ANALYTICS TABLES =====

// Content analytics table for tracking performance
export const contentAnalytics = pgTable(
  "content_analytics",
  {
    id: serial("id").primaryKey(),
    contentType: text("content_type").notNull(), // 'study', 'blog', 'article'
    contentId: integer("content_id").notNull(),

    // View metrics
    viewCount: integer("view_count").default(0),
    uniqueViewers: integer("unique_viewers").default(0),

    // Engagement metrics
    avgTimeSpent: integer("avg_time_spent").default(0), // in seconds
    totalTimeSpent: integer("total_time_spent").default(0), // total across all views
    bounceRate: integer("bounce_rate").default(0), // percentage (0-100)
    scrollDepth: integer("scroll_depth").default(0), // average percentage scrolled

    // Interaction metrics
    shareCount: integer("share_count").default(0),
    likeCount: integer("like_count").default(0),
    commentCount: integer("comment_count").default(0),
    downloadCount: integer("download_count").default(0),

    // Conversion metrics
    conversionRate: integer("conversion_rate").default(0), // percentage reading related content
    relatedContentClicks: integer("related_content_clicks").default(0),
    ctaClickRate: integer("cta_click_rate").default(0), // call-to-action click rate

    // A/B testing
    abTestVersion: text("ab_test_version"), // version identifier for A/B tests
    abTestMetrics: text("ab_test_metrics"), // JSON with test-specific metrics

    // Time-based metrics
    periodType: text("period_type").default("daily"), // 'hourly', 'daily', 'weekly', 'monthly'
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      contentIdx: index("content_analytics_content_idx").on(
        table.contentType,
        table.contentId,
      ),
      periodIdx: index("content_analytics_period_idx").on(
        table.periodStart,
        table.periodEnd,
      ),
      viewCountIdx: index("content_analytics_view_count_idx").on(
        table.viewCount,
      ),
    };
  },
);

// User engagement table for individual interaction tracking
export const userEngagement = pgTable(
  "user_engagement",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionId: text("session_id").notNull(), // for anonymous users
    contentType: text("content_type").notNull(), // 'study', 'blog', 'article'
    contentId: integer("content_id").notNull(),

    // Interaction details
    action: text("action").notNull(), // 'view', 'like', 'share', 'download', 'comment', 'click'
    actionValue: text("action_value"), // additional context (e.g., share platform, click target)

    // Time metrics
    timeSpent: integer("time_spent").default(0), // seconds spent on content
    scrollDepth: integer("scroll_depth").default(0), // percentage scrolled
    engagementScore: integer("engagement_score").default(0), // calculated engagement score

    // Context
    referrerType: text("referrer_type"), // 'search', 'social', 'direct', 'internal'
    referrerValue: text("referrer_value"), // specific referrer details
    deviceType: text("device_type"), // 'desktop', 'mobile', 'tablet'
    browserType: text("browser_type"),

    // Content context
    contentVersion: text("content_version"), // for A/B testing
    contentPosition: integer("content_position"), // position in list/search results

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      userIdx: index("user_engagement_user_idx").on(table.userId),
      sessionIdx: index("user_engagement_session_idx").on(table.sessionId),
      contentIdx: index("user_engagement_content_idx").on(
        table.contentType,
        table.contentId,
      ),
      actionIdx: index("user_engagement_action_idx").on(table.action),
      createdAtIdx: index("user_engagement_created_at_idx").on(table.createdAt),
    };
  },
);

// Content performance insights table for AI-generated recommendations
export const contentInsights = pgTable(
  "content_insights",
  {
    id: serial("id").primaryKey(),
    contentType: text("content_type").notNull(),
    contentId: integer("content_id").notNull(),

    // Performance patterns
    headlinePattern: text("headline_pattern"), // successful headline pattern identified
    optimalLength: integer("optimal_length"), // optimal content length in words
    bestKeywords: text("best_keywords").array(), // high-performing keywords
    bestTags: text("best_tags").array(), // high-performing tags

    // Recommendations
    improvementSuggestions: text("improvement_suggestions").array(),
    similarHighPerformers: text("similar_high_performers").array(), // IDs of similar successful content
    optimalPublishTime: text("optimal_publish_time"), // best time to publish

    // Audience insights
    primaryAudience: text("primary_audience"), // main audience segment
    audiencePreferences: text("audience_preferences"), // JSON with preference data
    readingLevel: integer("reading_level"), // optimal reading level

    // Content gaps
    missingTopics: text("missing_topics").array(),
    suggestedFollowUps: text("suggested_follow_ups").array(),

    // Performance prediction
    predictedEngagement: integer("predicted_engagement"), // predicted engagement score
    confidenceScore: integer("confidence_score"), // confidence in predictions (0-100)

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      contentIdx: unique("content_insights_content_unique").on(
        table.contentType,
        table.contentId,
      ),
    };
  },
);

// Create insertion schemas for analytics
export const insertContentAnalyticsSchema = createInsertSchema(
  contentAnalytics,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertUserEngagementSchema = createInsertSchema(
  userEngagement,
).omit({
  id: true,
  createdAt: true,
});
export const insertContentInsightsSchema = createInsertSchema(
  contentInsights,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for content analytics
export type ContentAnalytics = typeof contentAnalytics.$inferSelect;
export type UserEngagement = typeof userEngagement.$inferSelect;
export type ContentInsights = typeof contentInsights.$inferSelect;
export type InsertContentAnalytics = z.infer<
  typeof insertContentAnalyticsSchema
>;
export type InsertUserEngagement = z.infer<typeof insertUserEngagementSchema>;
export type InsertContentInsights = z.infer<typeof insertContentInsightsSchema>;

// ===== REVIEW ASSISTANT TABLES =====

// Study quality scores table for automated quality assessment
export const studyQualityScores = pgTable(
  "study_quality_scores",
  {
    id: serial("id").primaryKey(),
    studyId: integer("study_id")
      .notNull()
      .references(() => studies.id, { onDelete: "cascade" }),

    // Individual scores (0-100)
    methodologyScore: integer("methodology_score").notNull().default(0),
    impactScore: integer("impact_score").notNull().default(0),
    relevanceScore: integer("relevance_score").notNull().default(0),
    overallScore: integer("overall_score").notNull().default(0),

    // Detailed breakdown
    scoreBreakdown: text("score_breakdown"), // JSON with detailed scoring criteria

    // Red flags
    redFlags: text("red_flags").array(), // Array of identified red flags
    redFlagCount: integer("red_flag_count").notNull().default(0),

    // Methodology details
    sampleSizeScore: integer("sample_size_score").default(0),
    studyDesignScore: integer("study_design_score").default(0),
    blindingScore: integer("blinding_score").default(0),
    controlGroupScore: integer("control_group_score").default(0),
    statisticalRigorScore: integer("statistical_rigor_score").default(0),

    // Impact details
    journalImpactScore: integer("journal_impact_score").default(0),
    citationScore: integer("citation_score").default(0),
    authorReputationScore: integer("author_reputation_score").default(0),
    institutionScore: integer("institution_score").default(0),
    fundingQualityScore: integer("funding_quality_score").default(0),

    // Relevance details
    hydrogenFocusScore: integer("hydrogen_focus_score").default(0),
    humanStudyScore: integer("human_study_score").default(0),
    clinicalApplicabilityScore: integer("clinical_applicability_score").default(
      0,
    ),
    recencyScore: integer("recency_score").default(0),
    practicalImplicationsScore: integer("practical_implications_score").default(
      0,
    ),

    lastUpdated: timestamp("last_updated").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      studyIdIdx: unique("study_quality_scores_study_unique").on(table.studyId),
      overallScoreIdx: index("study_quality_scores_overall_idx").on(
        table.overallScore,
      ),
      redFlagCountIdx: index("study_quality_scores_red_flags_idx").on(
        table.redFlagCount,
      ),
    };
  },
);

// Review recommendations table for intelligent review assistance
export const reviewRecommendations = pgTable(
  "review_recommendations",
  {
    id: serial("id").primaryKey(),
    studyId: integer("study_id")
      .notNull()
      .references(() => studies.id, { onDelete: "cascade" }),

    // Priority and actions
    priority: text("priority").notNull().default("medium"), // 'high', 'medium', 'low'
    suggestedActions: text("suggested_actions").array(), // Array of recommended actions

    // Analysis results
    keyFindings: text("key_findings").array(), // Main findings from the study
    potentialIssues: text("potential_issues").array(), // Identified concerns
    strengthsIdentified: text("strengths_identified").array(), // Study strengths

    // Related content
    relatedStudyIds: integer("related_study_ids").array(), // IDs of similar studies
    suggestedCategories: text("suggested_categories").array(), // Auto-suggested categories
    suggestedTags: text("suggested_tags").array(), // Auto-suggested tags
    suggestedBlogTopics: text("suggested_blog_topics").array(), // Blog topic ideas

    // Auto-categorization results
    healthConditions: text("health_conditions").array(), // Detected health conditions
    bodySystems: text("body_systems").array(), // Affected body systems
    deliveryMethods: text("delivery_methods").array(), // H2 delivery methods used
    studyTypeClassification: text("study_type_classification"), // RCT, observational, etc.
    ageGroups: text("age_groups").array(), // Age demographics
    geographicRelevance: text("geographic_relevance").array(), // Geographic scope
    mechanismsOfAction: text("mechanisms_of_action").array(), // MOA identified

    // Grouping information
    researchTeamId: text("research_team_id"), // Identifier for research team
    studyGroupId: text("study_group_id"), // Group ID for batch review
    isFollowUp: boolean("is_follow_up").default(false),
    isReplication: boolean("is_replication").default(false),
    contradictsStudyIds: integer("contradicts_study_ids").array(), // IDs of contradicting studies

    // AI analysis metadata
    confidenceScore: integer("confidence_score").default(0), // AI confidence (0-100)
    analysisVersion: text("analysis_version"), // Version of analysis algorithm

    lastUpdated: timestamp("last_updated").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      studyIdIdx: unique("review_recommendations_study_unique").on(
        table.studyId,
      ),
      priorityIdx: index("review_recommendations_priority_idx").on(
        table.priority,
      ),
      studyGroupIdx: index("review_recommendations_group_idx").on(
        table.studyGroupId,
      ),
    };
  },
);

// Create insertion schemas for review assistant
export const insertStudyQualityScoresSchema = createInsertSchema(
  studyQualityScores,
).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});
export const insertReviewRecommendationsSchema = createInsertSchema(
  reviewRecommendations,
).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

// Types for review assistant
export type StudyQualityScores = typeof studyQualityScores.$inferSelect;
export type ReviewRecommendations = typeof reviewRecommendations.$inferSelect;
export type InsertStudyQualityScores = z.infer<
  typeof insertStudyQualityScoresSchema
>;
export type InsertReviewRecommendations = z.infer<
  typeof insertReviewRecommendationsSchema
>;

// Content Relationships table - tracks relationships between content pieces
export const contentRelationships = pgTable(
  "content_relationships",
  {
    id: serial("id").primaryKey(),
    sourceType: text("source_type").notNull(), // 'blog', 'study', 'scientific_article'
    sourceId: integer("source_id").notNull(),
    targetType: text("target_type").notNull(), // 'blog', 'study', 'scientific_article'
    targetId: integer("target_id").notNull(),
    relationshipType: text("relationship_type").notNull(), // 'supports', 'contradicts', 'references', 'extends', 'updates'
    confidence: integer("confidence").default(100), // Confidence score 0-100
    autoDetected: boolean("auto_detected").default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      sourceIdx: index("content_relationships_source_idx").on(
        table.sourceType,
        table.sourceId,
      ),
      targetIdx: index("content_relationships_target_idx").on(
        table.targetType,
        table.targetId,
      ),
      relationshipTypeIdx: index("content_relationships_type_idx").on(
        table.relationshipType,
      ),
    };
  },
);

// Content Versions table - tracks version history of content
export const contentVersions = pgTable(
  "content_versions",
  {
    id: serial("id").primaryKey(),
    contentType: text("content_type").notNull(), // 'blog', 'study', 'scientific_article'
    contentId: integer("content_id").notNull(),
    versionNumber: integer("version_number").notNull().default(1),
    title: text("title").notNull(),
    content: text("content").notNull(),
    summary: text("summary"),
    changeNotes: text("change_notes"),
    changedBy: text("changed_by"), // User ID who made the change
    changeReason: text("change_reason"), // 'new_evidence', 'correction', 'update', 'enhancement'
    previousVersionId: integer("previous_version_id"),
    isLatest: boolean("is_latest").default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      contentIdx: index("content_versions_content_idx").on(
        table.contentType,
        table.contentId,
      ),
      versionNumberIdx: index("content_versions_version_idx").on(
        table.versionNumber,
      ),
      isLatestIdx: index("content_versions_latest_idx").on(table.isLatest),
    };
  },
);

// Update Notifications table - tracks content update notifications
export const updateNotifications = pgTable(
  "update_notifications",
  {
    id: serial("id").primaryKey(),
    contentType: text("content_type").notNull(), // 'blog', 'study', 'scientific_article'
    contentId: integer("content_id").notNull(),
    triggerType: text("trigger_type").notNull(), // 'new_study', 'contradicting_evidence', 'supporting_evidence', 'outdated_data'
    triggerContentId: integer("trigger_content_id"), // The new study/content that triggered the update
    priority: text("priority").notNull().default("medium"), // 'critical', 'high', 'medium', 'low'
    priorityScore: integer("priority_score").default(50), // 0-100
    status: text("status").notNull().default("pending"), // 'pending', 'in_review', 'approved', 'applied', 'rejected'
    updateSummary: text("update_summary"),
    suggestedChanges: text("suggested_changes"),
    impactedSections: text("impacted_sections").array(),
    reviewedBy: text("reviewed_by"), // User ID who reviewed
    reviewedAt: timestamp("reviewed_at"),
    appliedAt: timestamp("applied_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      contentIdx: index("update_notifications_content_idx").on(
        table.contentType,
        table.contentId,
      ),
      statusIdx: index("update_notifications_status_idx").on(table.status),
      priorityIdx: index("update_notifications_priority_idx").on(
        table.priority,
        table.priorityScore,
      ),
      createdAtIdx: index("update_notifications_created_idx").on(
        table.createdAt,
      ),
    };
  },
);

// Content Dependencies table - tracks which content depends on which studies/data
export const contentDependencies = pgTable(
  "content_dependencies",
  {
    id: serial("id").primaryKey(),
    contentType: text("content_type").notNull(), // 'blog', 'scientific_article'
    contentId: integer("content_id").notNull(),
    dependencyType: text("dependency_type").notNull(), // 'study', 'statistic', 'citation', 'claim'
    dependencyId: integer("dependency_id"),
    dependencyDetails: text("dependency_details"), // JSON with specific details
    importance: text("importance").default("normal"), // 'critical', 'high', 'normal', 'low'
    lastVerified: timestamp("last_verified"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      contentIdx: index("content_dependencies_content_idx").on(
        table.contentType,
        table.contentId,
      ),
      dependencyIdx: index("content_dependencies_dependency_idx").on(
        table.dependencyType,
        table.dependencyId,
      ),
    };
  },
);

// Update History table - tracks all updates made to content
export const updateHistory = pgTable(
  "update_history",
  {
    id: serial("id").primaryKey(),
    contentType: text("content_type").notNull(),
    contentId: integer("content_id").notNull(),
    updateType: text("update_type").notNull(), // 'auto_update', 'manual_update', 'correction', 'enhancement'
    previousVersion: text("previous_version"),
    newVersion: text("new_version"),
    changedFields: text("changed_fields").array(),
    changeDescription: text("change_description"),
    performedBy: text("performed_by"), // User ID or 'system'
    notificationId: integer("notification_id").references(
      () => updateNotifications.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      contentIdx: index("update_history_content_idx").on(
        table.contentType,
        table.contentId,
      ),
      updateTypeIdx: index("update_history_type_idx").on(table.updateType),
      createdAtIdx: index("update_history_created_idx").on(table.createdAt),
    };
  },
);

// Smart Links table - tracks intelligent internal links for SEO
export const smartLinks = pgTable(
  "smart_links",
  {
    id: serial("id").primaryKey(),
    fromType: text("from_type").notNull(), // Source content type
    fromId: integer("from_id").notNull(),
    toType: text("to_type").notNull(), // Target content type
    toId: integer("to_id").notNull(),
    anchorText: text("anchor_text").notNull(),
    context: text("context"), // Surrounding text context
    relevanceScore: integer("relevance_score").default(100), // 0-100
    linkType: text("link_type").default("contextual"), // 'contextual', 'related', 'citation', 'update'
    autoGenerated: boolean("auto_generated").default(false),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      fromIdx: index("smart_links_from_idx").on(table.fromType, table.fromId),
      toIdx: index("smart_links_to_idx").on(table.toType, table.toId),
      activeIdx: index("smart_links_active_idx").on(table.isActive),
    };
  },
);

// Create insertion schemas for Dynamic Content Optimization
export const insertContentRelationshipSchema = createInsertSchema(
  contentRelationships,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertContentVersionSchema = createInsertSchema(
  contentVersions,
).omit({
  id: true,
  createdAt: true,
});
export const insertUpdateNotificationSchema = createInsertSchema(
  updateNotifications,
).omit({
  id: true,
  createdAt: true,
});
export const insertContentDependencySchema = createInsertSchema(
  contentDependencies,
).omit({
  id: true,
  createdAt: true,
});
export const insertUpdateHistorySchema = createInsertSchema(updateHistory).omit(
  {
    id: true,
    createdAt: true,
  },
);
export const insertSmartLinkSchema = createInsertSchema(smartLinks).omit({
  id: true,
  createdAt: true,
});

// Types for Dynamic Content Optimization
export type ContentRelationship = typeof contentRelationships.$inferSelect;
export type ContentVersion = typeof contentVersions.$inferSelect;
export type UpdateNotification = typeof updateNotifications.$inferSelect;
export type ContentDependency = typeof contentDependencies.$inferSelect;
export type UpdateHistory = typeof updateHistory.$inferSelect;
export type SmartLink = typeof smartLinks.$inferSelect;
export type InsertContentRelationship = z.infer<
  typeof insertContentRelationshipSchema
>;
export type InsertContentVersion = z.infer<typeof insertContentVersionSchema>;
export type InsertUpdateNotification = z.infer<
  typeof insertUpdateNotificationSchema
>;
export type InsertContentDependency = z.infer<
  typeof insertContentDependencySchema
>;
export type InsertUpdateHistory = z.infer<typeof insertUpdateHistorySchema>;
export type InsertSmartLink = z.infer<typeof insertSmartLinkSchema>;

// Study category types
export type StudyCategory = typeof studyCategories.$inferSelect;
export type InsertStudyCategory = typeof studyCategories.$inferInsert;

// Authentication schemas and types
export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  createdAt: true,
  lastActivity: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

// Authentication types
export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Blog generation job queue — supports thousands of blogs via background processing
export const blogGenerationJobs = pgTable("blog_generation_jobs", {
  id: serial("id").primaryKey(),
  // Job configuration
  studyIds: integer("study_ids").array().notNull(),
  articleTypes: text("article_types").array().notNull(),
  readingLevel: text("reading_level").notNull().default("general"),
  includeImages: boolean("include_images").default(true),
  includeSEO: boolean("include_seo").default(true),
  // Job status
  status: text("status").notNull().default("pending"), // pending | running | paused | completed | failed | cancelled
  // Progress tracking
  totalItems: integer("total_items").notNull().default(0), // studyIds.length * articleTypes.length
  completedItems: integer("completed_items").notNull().default(0),
  failedItems: integer("failed_items").notNull().default(0),
  savedItems: integer("saved_items").notNull().default(0),
  // Current position (for resume)
  currentStudyIndex: integer("current_study_index").notNull().default(0),
  currentTypeIndex: integer("current_type_index").notNull().default(0),
  // Error tracking
  lastError: text("last_error"),
  errors: text("errors"), // JSON array of { studyId, articleType, error }
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// SEO Content Strategy — keyword-centric pillar/cluster content model
export const seoContentClusters = pgTable("seo_content_clusters", {
  id: serial("id").primaryKey(),
  // Keyword targeting
  pillarKeyword: text("pillar_keyword").notNull(), // e.g. "hydrogen water bottle"
  pillarTitle: text("pillar_title").notNull(), // e.g. "The Ultimate Guide to Hydrogen Water Bottles"
  slug: text("slug").notNull().unique(),
  // Classification
  category: text("category").notNull().default("research"), // product | research | competitor
  targetAudience: text("target_audience").notNull().default("consumer"), // consumer | researcher | skeptic
  searchIntent: text("search_intent").notNull().default("informational"), // informational | commercial | transactional
  // Cluster configuration
  clusterKeywords: text("cluster_keywords").notNull().default("[]"), // JSON: [{ keyword, title, slug, articleType, searchIntent }]
  // Content status
  pillarArticleId: integer("pillar_article_id"), // FK to blogArticles when generated
  totalClusterPosts: integer("total_cluster_posts").notNull().default(0),
  generatedClusterPosts: integer("generated_cluster_posts").notNull().default(0),
  // Echo Water integration
  echoProductReferences: text("echo_product_references").notNull().default("[]"), // JSON: [{ product, url, keyword }]
  includeProductCTA: boolean("include_product_cta").notNull().default(true),
  // SEO metrics
  estimatedSearchVolume: integer("estimated_search_volume"),
  keywordDifficulty: integer("keyword_difficulty"), // 0-100
  priority: integer("priority").notNull().default(50), // 0-100
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================================
// Research Intelligence Pipeline Tables
// ============================================================

// Pipeline queue — items queued for AI processing
export const pipelineQueue = pgTable(
  "pipeline_queue",
  {
    id: serial("id").primaryKey(),
    doi: text("doi"),
    title: text("title").notNull(),
    authors: text("authors"),
    journal: text("journal"),
    publishDate: text("publish_date"),
    abstract: text("abstract"),
    sourceUrl: text("source_url"),
    sourcePlatform: text("source_platform"), // crossref | europepmc
    // Processing state
    status: text("status").notNull().default("pending"), // pending | processing | completed | failed
    currentStep: integer("current_step").notNull().default(0), // 0-5 (AI pipeline steps)
    stepResults: text("step_results").notNull().default("{}"), // JSON: accumulated results from each step
    // Output
    createdStudyId: integer("created_study_id").references(() => studies.id, { onDelete: "cascade" }),
    // Error tracking
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(3),
    // Discovery run reference
    discoveryRunId: integer("discovery_run_id"),
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    processedAt: timestamp("processed_at"),
  },
  (table) => {
    return {
      statusIdx: index("pipeline_queue_status_idx").on(table.status),
      doiIdx: index("pipeline_queue_doi_idx").on(table.doi),
      createdAtIdx: index("pipeline_queue_created_at_idx").on(table.createdAt),
    };
  },
);

export const insertPipelineQueueSchema = createInsertSchema(pipelineQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PipelineQueueItem = typeof pipelineQueue.$inferSelect;
export type InsertPipelineQueueItem = z.infer<typeof insertPipelineQueueSchema>;

// Discovery runs — history of each research discovery run
export const discoveryRuns = pgTable(
  "discovery_runs",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(), // crossref | europepmc | both
    queries: text("queries").notNull().default("[]"), // JSON array of queries used
    foundCount: integer("found_count").notNull().default(0),
    newCount: integer("new_count").notNull().default(0),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    queuedCount: integer("queued_count").notNull().default(0),
    durationMs: integer("duration_ms"),
    status: text("status").notNull().default("running"), // running | completed | failed
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      createdAtIdx: index("discovery_runs_created_at_idx").on(table.createdAt),
      statusIdx: index("discovery_runs_status_idx").on(table.status),
    };
  },
);

export const insertDiscoveryRunSchema = createInsertSchema(discoveryRuns).omit({
  id: true,
  createdAt: true,
});
export type DiscoveryRun = typeof discoveryRuns.$inferSelect;
export type InsertDiscoveryRun = z.infer<typeof insertDiscoveryRunSchema>;

// Study citations — real citation relationships between studies
export const studyCitations = pgTable(
  "study_citations",
  {
    id: serial("id").primaryKey(),
    fromStudyId: integer("from_study_id")
      .notNull()
      .references(() => studies.id, { onDelete: "cascade" }),
    toStudyId: integer("to_study_id")
      .references(() => studies.id, { onDelete: "cascade" }),
    toDoi: text("to_doi"), // external DOI if not in our database
    toTitle: text("to_title"), // external title for display
    direction: text("direction").notNull(), // cites | cited_by
    source: text("source").notNull().default("crossref"), // crossref | europepmc | manual
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      fromStudyIdx: index("study_citations_from_idx").on(table.fromStudyId),
      toStudyIdx: index("study_citations_to_idx").on(table.toStudyId),
      toDoiIdx: index("study_citations_to_doi_idx").on(table.toDoi),
    };
  },
);

export const insertStudyCitationSchema = createInsertSchema(studyCitations).omit({
  id: true,
  createdAt: true,
});
export type StudyCitation = typeof studyCitations.$inferSelect;
export type InsertStudyCitation = z.infer<typeof insertStudyCitationSchema>;

// Research digests — weekly summary content
export const researchDigests = pgTable(
  "research_digests",
  {
    id: serial("id").primaryKey(),
    weekStart: text("week_start").notNull(), // ISO date string for the Monday
    weekEnd: text("week_end").notNull(), // ISO date string for the Sunday
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    narrative: text("narrative").notNull(), // Full HTML content
    narrativeMarkdown: text("narrative_markdown"), // Markdown version
    trendingTopics: text("trending_topics").notNull().default("[]"), // JSON array of topic strings
    notableFindings: text("notable_findings").notNull().default("[]"), // JSON array of { studyId, title, finding }
    studyCount: integer("study_count").notNull().default(0),
    studyIds: text("study_ids").notNull().default("[]"), // JSON array of study IDs included
    // SEO
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    // Status
    isPublished: boolean("is_published").notNull().default(false),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      slugIdx: index("research_digests_slug_idx").on(table.slug),
      weekStartIdx: index("research_digests_week_start_idx").on(table.weekStart),
      publishedIdx: index("research_digests_published_idx").on(table.isPublished),
    };
  },
);

export const insertResearchDigestSchema = createInsertSchema(researchDigests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ResearchDigest = typeof researchDigests.$inferSelect;
export type InsertResearchDigest = z.infer<typeof insertResearchDigestSchema>;

// ── Redirect System ──────────────────────────────────────────

export const redirects = pgTable(
  "redirects",
  {
    id: serial("id").primaryKey(),
    fromPath: text("from_path").notNull(), // the old/broken path (lowercase, no query string)
    toPath: text("to_path").notNull(), // where to send the user
    statusCode: integer("status_code").notNull().default(301), // 301 permanent or 302 temporary
    hitCount: integer("hit_count").notNull().default(0),
    lastHitAt: timestamp("last_hit_at"),
    isActive: boolean("is_active").notNull().default(true),
    note: text("note"), // optional admin note
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      fromPathIdx: unique("redirects_from_path_uniq").on(table.fromPath),
    };
  },
);

export const insertRedirectSchema = createInsertSchema(redirects).omit({
  id: true,
  hitCount: true,
  lastHitAt: true,
  createdAt: true,
});
export type Redirect = typeof redirects.$inferSelect;
export type InsertRedirect = z.infer<typeof insertRedirectSchema>;

export const notFoundLog = pgTable(
  "not_found_log",
  {
    id: serial("id").primaryKey(),
    path: text("path").notNull(), // the 404 path (lowercase, no query string)
    referrer: text("referrer"), // HTTP Referer header
    hitCount: integer("hit_count").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    resolved: boolean("resolved").notNull().default(false), // true once a redirect is created
    suggestedTarget: text("suggested_target"), // back-compat: top-ranked target string (mirrors suggestions[0].target)
    suggestions: jsonb("suggestions").$type<RedirectSuggestion[]>(), // ranked candidates with score + reasons
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      pathIdx: unique("not_found_log_path_uniq").on(table.path),
      hitCountIdx: index("not_found_log_hit_count_idx").on(table.hitCount),
      resolvedIdx: index("not_found_log_resolved_idx").on(table.resolved),
    };
  },
);

export type NotFoundLogEntry = typeof notFoundLog.$inferSelect;

export interface RedirectSuggestion {
  target: string; // absolute path, e.g. "/studies/foo"
  contentType: "study" | "blog" | "condition";
  title: string | null; // human-readable label for admin UI
  score: number; // 0–1, higher is better
  reasons: string[]; // short human-readable match explanations
}

// ── Stored Images (database-backed image storage) ──────────────────────
export const storedImages = pgTable(
  "stored_images",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(), // e.g. "blog-images/blog-science-123-1234567890.png"
    data: bytea("data").notNull(),
    contentType: text("content_type").notNull().default("image/png"),
    size: integer("size").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      keyIdx: unique("stored_images_key_uniq").on(table.key),
    };
  },
);

export type StoredImage = typeof storedImages.$inferSelect;
