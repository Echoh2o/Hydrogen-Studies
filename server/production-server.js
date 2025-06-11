var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  CategorizationModel: () => CategorizationModel,
  ReviewStatus: () => ReviewStatus,
  blogArticles: () => blogArticles,
  bodySystems: () => bodySystems,
  categories: () => categories,
  chatFeedback: () => chatFeedback,
  chatMessages: () => chatMessages,
  collectionStudies: () => collectionStudies,
  consumerCategories: () => consumerCategories,
  contactMessages: () => contactMessages,
  conversations: () => conversations,
  educationalResources: () => educationalResources,
  excludedKeywords: () => excludedKeywords,
  faqItems: () => faqItems,
  glossaryTerms: () => glossaryTerms,
  healthConditions: () => healthConditions,
  insertBlogArticleSchema: () => insertBlogArticleSchema,
  insertCategorySchema: () => insertCategorySchema,
  insertChatFeedbackSchema: () => insertChatFeedbackSchema,
  insertChatMessageSchema: () => insertChatMessageSchema,
  insertCollectionStudySchema: () => insertCollectionStudySchema,
  insertContactSchema: () => insertContactSchema,
  insertConversationSchema: () => insertConversationSchema,
  insertEducationalResourceSchema: () => insertEducationalResourceSchema,
  insertExcludedKeywordSchema: () => insertExcludedKeywordSchema,
  insertFaqItemSchema: () => insertFaqItemSchema,
  insertGlossaryTermSchema: () => insertGlossaryTermSchema,
  insertKeywordGroupMappingSchema: () => insertKeywordGroupMappingSchema,
  insertKeywordGroupSchema: () => insertKeywordGroupSchema,
  insertKeywordSchema: () => insertKeywordSchema,
  insertMonitorResultSchema: () => insertMonitorResultSchema,
  insertMonitorScheduleSchema: () => insertMonitorScheduleSchema,
  insertNewsletterSchema: () => insertNewsletterSchema,
  insertNotificationSchema: () => insertNotificationSchema,
  insertPopularQuestionSchema: () => insertPopularQuestionSchema,
  insertSearchHistorySchema: () => insertSearchHistorySchema,
  insertStudyCollectionSchema: () => insertStudyCollectionSchema,
  insertStudyReviewQueueSchema: () => insertStudyReviewQueueSchema,
  insertStudySchema: () => insertStudySchema,
  insertStudyTagSchema: () => insertStudyTagSchema,
  insertTagCategorySchema: () => insertTagCategorySchema,
  insertTagSchema: () => insertTagSchema,
  insertTagSynonymSchema: () => insertTagSynonymSchema,
  insertUserBlogInteractionSchema: () => insertUserBlogInteractionSchema,
  insertUserPreferencesSchema: () => insertUserPreferencesSchema,
  insertUserSchema: () => insertUserSchema,
  insertUserStudyInteractionSchema: () => insertUserStudyInteractionSchema,
  keywordGroupMappings: () => keywordGroupMappings,
  keywordGroups: () => keywordGroups,
  keywords: () => keywords,
  monitorResults: () => monitorResults,
  monitorSchedule: () => monitorSchedule,
  newsletters: () => newsletters,
  notifications: () => notifications,
  popularQuestions: () => popularQuestions,
  scrapedSources: () => scrapedSources,
  searchHistory: () => searchHistory,
  studies: () => studies,
  studyCategories: () => studyCategories,
  studyCollections: () => studyCollections,
  studyHealthConditions: () => studyHealthConditions,
  studyReviewQueue: () => studyReviewQueue,
  studyTags: () => studyTags,
  tagCategories: () => tagCategories,
  tagSynonyms: () => tagSynonyms,
  tags: () => tags,
  userBlogInteractions: () => userBlogInteractions,
  userPreferences: () => userPreferences,
  userStudyInteractions: () => userStudyInteractions,
  users: () => users
});
import { pgTable, text, serial, integer, boolean, timestamp, primaryKey, varchar, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var CategorizationModel, users, userPreferences, searchHistory, userStudyInteractions, notifications, userBlogInteractions, studies, categories, studyCategories, bodySystems, healthConditions, studyHealthConditions, studyCollections, consumerCategories, collectionStudies, newsletters, educationalResources, glossaryTerms, faqItems, contactMessages, scrapedSources, ReviewStatus, studyReviewQueue, blogArticles, insertStudySchema, insertCategorySchema, insertNewsletterSchema, insertContactSchema, insertBlogArticleSchema, insertUserSchema, insertUserPreferencesSchema, insertSearchHistorySchema, insertNotificationSchema, insertUserStudyInteractionSchema, insertUserBlogInteractionSchema, insertEducationalResourceSchema, insertGlossaryTermSchema, insertFaqItemSchema, insertStudyCollectionSchema, insertCollectionStudySchema, insertStudyReviewQueueSchema, conversations, chatMessages, chatFeedback, popularQuestions, insertConversationSchema, insertChatMessageSchema, insertChatFeedbackSchema, insertPopularQuestionSchema, keywords, excludedKeywords, keywordGroups, keywordGroupMappings, monitorSchedule, monitorResults, insertKeywordSchema, insertExcludedKeywordSchema, insertKeywordGroupSchema, insertKeywordGroupMappingSchema, insertMonitorResultSchema, insertMonitorScheduleSchema, tags, studyTags, tagCategories, tagSynonyms, insertTagSchema, insertStudyTagSchema, insertTagCategorySchema, insertTagSynonymSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    CategorizationModel = /* @__PURE__ */ ((CategorizationModel2) => {
      CategorizationModel2["CONDITION"] = "condition";
      CategorizationModel2["BODY_SYSTEM"] = "body_system";
      CategorizationModel2["LIFE_STAGE"] = "life_stage";
      return CategorizationModel2;
    })(CategorizationModel || {});
    users = pgTable("users", {
      id: text("id").primaryKey().notNull(),
      // Store Replit user ID
      email: text("email"),
      firstName: text("first_name"),
      lastName: text("last_name"),
      profileImageUrl: text("profile_image_url"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    userPreferences = pgTable("user_preferences", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull().references(() => users.id),
      categories: text("categories").array(),
      keywords: text("keywords").array(),
      authors: text("authors").array(),
      emailNotifications: boolean("email_notifications").default(true),
      notificationFrequency: text("notification_frequency").default("weekly"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    searchHistory = pgTable("search_history", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull().references(() => users.id),
      searchQuery: text("search_query").notNull(),
      searchDate: timestamp("search_date").notNull().defaultNow()
    });
    userStudyInteractions = pgTable("user_study_interactions", {
      userId: text("user_id").notNull().references(() => users.id),
      studyId: integer("study_id").notNull().references(() => studies.id),
      isSaved: boolean("is_saved").default(false),
      viewCount: integer("view_count").default(0),
      lastViewed: timestamp("last_viewed").notNull().defaultNow(),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => {
      return {
        pk: primaryKey({ columns: [table.userId, table.studyId] })
      };
    });
    notifications = pgTable("notifications", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull().references(() => users.id),
      title: text("title").notNull(),
      message: text("message").notNull(),
      type: text("type").notNull(),
      // "study", "blog", "system"
      referenceId: integer("reference_id"),
      // Study or blog ID
      isRead: boolean("is_read").default(false),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    userBlogInteractions = pgTable("user_blog_interactions", {
      userId: integer("user_id").notNull().references(() => users.id),
      blogId: integer("blog_id").notNull().references(() => blogArticles.id),
      isSaved: boolean("is_saved").default(false),
      viewCount: integer("view_count").default(0),
      lastViewed: timestamp("last_viewed").notNull().defaultNow(),
      createdAt: timestamp("created_at").notNull().defaultNow()
    }, (table) => {
      return {
        pk: primaryKey({ columns: [table.userId, table.blogId] })
      };
    });
    studies = pgTable("studies", {
      id: serial("id").primaryKey(),
      title: text("title").notNull(),
      abstract: text("abstract").notNull(),
      authors: text("authors").notNull(),
      journal: text("journal").notNull(),
      publishDate: text("publish_date").notNull(),
      // Date when study was added to our site
      journalPublishDate: text("journal_publish_date"),
      // Original publication date in the journal
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
      studyType: text("study_type"),
      // human, animal, in vitro
      outcome: text("outcome"),
      // positive, neutral, negative
      sampleSize: integer("sample_size"),
      duration: integer("duration"),
      // Study duration in days
      hasFullText: boolean("has_full_text").default(false),
      viewCount: integer("view_count").default(0),
      citationCount: integer("citation_count").default(0),
      // Source tracking information
      sourceUrl: text("source_url"),
      sourcePlatform: text("source_platform"),
      // Only include fields that exist in the database
      keywords: text("keywords").array(),
      // Author-provided keywords
      plainLanguageTitle: text("plain_language_title"),
      // SEO-optimized consumer-friendly title
      slug: text("slug"),
      // URL-friendly slug generated from plain language title
      // Authentic research data fields from PubMed/CrossRef APIs
      authorAffiliations: text("author_affiliations"),
      // Real institutional affiliations
      fundingSources: text("funding_sources"),
      // Actual grant information
      statisticalMethods: text("statistical_methods"),
      // Research methodology details
      ethicalApproval: text("ethical_approval"),
      // Ethics committee information
      fullText: text("full_text"),
      // Full research paper content when available
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    categories = pgTable("categories", {
      id: serial("id").primaryKey(),
      name: text("name").notNull().unique(),
      description: text("description").notNull(),
      icon: text("icon"),
      studyCount: integer("study_count").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    studyCategories = pgTable("study_categories", {
      id: serial("id").primaryKey(),
      studyId: integer("study_id").notNull().references(() => studies.id, { onDelete: "cascade" }),
      categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
      isPrimary: boolean("is_primary").notNull().default(false),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    bodySystems = pgTable("body_systems", {
      id: serial("id").primaryKey(),
      name: text("name").notNull().unique(),
      description: text("description").notNull(),
      icon: text("icon"),
      slug: text("slug").notNull().unique(),
      displayOrder: integer("display_order").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    healthConditions = pgTable("health_conditions", {
      id: serial("id").primaryKey(),
      name: text("name").notNull().unique(),
      description: text("description").notNull(),
      bodySystemId: integer("body_system_id").notNull().references(() => bodySystems.id),
      slug: text("slug").notNull().unique(),
      displayOrder: integer("display_order").notNull().default(0),
      studyCount: integer("study_count").notNull().default(0),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    studyHealthConditions = pgTable("study_health_conditions", {
      studyId: integer("study_id").notNull().references(() => studies.id),
      healthConditionId: integer("health_condition_id").notNull().references(() => healthConditions.id)
    }, (table) => {
      return {
        pk: primaryKey({ columns: [table.studyId, table.healthConditionId] })
      };
    });
    studyCollections = pgTable("study_collections", {
      id: serial("id").primaryKey(),
      name: text("name").notNull().unique(),
      description: text("description").notNull(),
      slug: text("slug").notNull().unique(),
      imageUrl: text("image_url"),
      imageAlt: text("image_alt"),
      featuredOrder: integer("featured_order").default(0),
      isPublished: boolean("is_published").default(true),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    consumerCategories = pgTable("consumer_categories", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      description: text("description"),
      categoryModel: text("category_model").notNull(),
      // 'condition', 'body_system', 'life_stage'
      slug: text("slug").notNull().unique(),
      studyCount: integer("study_count").default(0),
      displayOrder: integer("display_order").default(0),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    collectionStudies = pgTable("collection_studies", {
      collectionId: integer("collection_id").notNull().references(() => studyCollections.id),
      studyId: integer("study_id").notNull().references(() => studies.id),
      displayOrder: integer("display_order").default(0),
      addedAt: timestamp("added_at").notNull().defaultNow()
    }, (table) => {
      return {
        pk: primaryKey({ columns: [table.collectionId, table.studyId] })
      };
    });
    newsletters = pgTable("newsletters", {
      id: serial("id").primaryKey(),
      email: text("email").notNull().unique(),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    educationalResources = pgTable("educational_resources", {
      id: serial("id").primaryKey(),
      title: text("title").notNull(),
      slug: text("slug").notNull().unique(),
      content: text("content").notNull(),
      contentMarkdown: text("content_markdown").notNull(),
      resourceType: text("resource_type").notNull(),
      // glossary, faq, tutorial, guide
      featuredOrder: integer("featured_order").default(0),
      viewCount: integer("view_count").default(0),
      isPublished: boolean("is_published").default(true),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    glossaryTerms = pgTable("glossary_terms", {
      id: serial("id").primaryKey(),
      term: text("term").notNull().unique(),
      definition: text("definition").notNull(),
      longDefinition: text("long_definition"),
      references: text("references"),
      relatedTerms: text("related_terms").array(),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    faqItems = pgTable("faq_items", {
      id: serial("id").primaryKey(),
      question: text("question").notNull(),
      answer: text("answer").notNull(),
      answerMarkdown: text("answer_markdown").notNull(),
      category: text("category").notNull(),
      // general, scientific, application
      displayOrder: integer("display_order").default(0),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    contactMessages = pgTable("contact_messages", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      email: text("email").notNull(),
      message: text("message").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    scrapedSources = pgTable("scraped_sources", {
      id: serial("id").primaryKey(),
      sourceUrl: text("source_url").notNull(),
      sourcePlatform: text("source_platform").notNull(),
      studyId: integer("study_id").notNull().references(() => studies.id),
      scrapedAt: timestamp("scraped_at").notNull().defaultNow()
    });
    ReviewStatus = {
      PENDING: "pending",
      APPROVED: "approved",
      REJECTED: "rejected"
    };
    studyReviewQueue = pgTable("study_review_queue", {
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
      savedByUserId: text("saved_by_user_id").references(() => users.id),
      reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
      // Notes added during the review process
      reviewNotes: text("review_notes"),
      // Whether this entry is a duplicate of an existing study
      isDuplicate: boolean("is_duplicate").default(false),
      // If it's a duplicate, this references the original study
      duplicateOfStudyId: integer("duplicate_of_study_id").references(() => studies.id),
      // Timestamps
      savedAt: timestamp("saved_at").notNull().defaultNow(),
      reviewedAt: timestamp("reviewed_at"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    blogArticles = pgTable("blog_articles", {
      id: serial("id").primaryKey(),
      studyId: integer("study_id").notNull().references(() => studies.id),
      title: text("title").notNull(),
      slug: text("slug").notNull().unique(),
      summary: text("summary").notNull(),
      content: text("content").notNull(),
      quickInsights: text("quick_insights"),
      imageUrl: text("image_url"),
      imageAlt: text("image_alt"),
      readingLevel: text("reading_level").default("general"),
      articleType: text("article_type"),
      isPublished: boolean("is_published").default(false),
      editorNotes: text("editor_notes"),
      viewCount: integer("view_count").default(0),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    insertStudySchema = createInsertSchema(studies).omit({ id: true, createdAt: true });
    insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
    insertNewsletterSchema = createInsertSchema(newsletters).omit({ id: true, createdAt: true });
    insertContactSchema = createInsertSchema(contactMessages).omit({ id: true, createdAt: true });
    insertBlogArticleSchema = createInsertSchema(blogArticles).omit({ id: true, createdAt: true, updatedAt: true, viewCount: true });
    insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
    insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({ id: true, createdAt: true, updatedAt: true });
    insertSearchHistorySchema = createInsertSchema(searchHistory).omit({ id: true, searchDate: true });
    insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
    insertUserStudyInteractionSchema = createInsertSchema(userStudyInteractions).omit({ createdAt: true });
    insertUserBlogInteractionSchema = createInsertSchema(userBlogInteractions).omit({ createdAt: true });
    insertEducationalResourceSchema = createInsertSchema(educationalResources).omit({ id: true, createdAt: true, updatedAt: true, viewCount: true });
    insertGlossaryTermSchema = createInsertSchema(glossaryTerms).omit({ id: true, createdAt: true, updatedAt: true });
    insertFaqItemSchema = createInsertSchema(faqItems).omit({ id: true, createdAt: true, updatedAt: true });
    insertStudyCollectionSchema = createInsertSchema(studyCollections).omit({ id: true, createdAt: true, updatedAt: true });
    insertCollectionStudySchema = createInsertSchema(collectionStudies).omit({ addedAt: true });
    insertStudyReviewQueueSchema = createInsertSchema(studyReviewQueue).omit({
      id: true,
      savedAt: true,
      reviewedAt: true,
      createdAt: true
    });
    conversations = pgTable("conversations", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").references(() => users.id),
      title: text("title").default("New Conversation"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow()
    });
    chatMessages = pgTable("chat_messages", {
      id: serial("id").primaryKey(),
      conversationId: integer("conversation_id").notNull().references(() => conversations.id),
      role: varchar("role", { length: 20 }).notNull(),
      // 'user' or 'assistant'
      content: text("content").notNull(),
      timestamp: timestamp("timestamp").notNull().defaultNow()
    });
    chatFeedback = pgTable("chat_feedback", {
      id: serial("id").primaryKey(),
      messageId: integer("message_id").notNull().references(() => chatMessages.id),
      userId: integer("user_id").references(() => users.id),
      rating: integer("rating").notNull(),
      // 1 (thumbs down) or 5 (thumbs up)
      comment: text("comment"),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    popularQuestions = pgTable("popular_questions", {
      id: serial("id").primaryKey(),
      question: text("question").notNull().unique(),
      category: text("category").notNull(),
      displayOrder: integer("display_order").default(0),
      clickCount: integer("click_count").default(0),
      createdAt: timestamp("created_at").notNull().defaultNow()
    });
    insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true, updatedAt: true });
    insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, timestamp: true });
    insertChatFeedbackSchema = createInsertSchema(chatFeedback).omit({ id: true, createdAt: true });
    insertPopularQuestionSchema = createInsertSchema(popularQuestions).omit({ id: true, clickCount: true, createdAt: true });
    keywords = pgTable("keywords", {
      id: serial("id").primaryKey(),
      term: text("term").notNull(),
      category: text("category").default("general").notNull(),
      isActive: boolean("is_active").default(true).notNull(),
      lastSearched: timestamp("last_searched"),
      matchCount: integer("match_count").default(0),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    excludedKeywords = pgTable("excluded_keywords", {
      id: serial("id").primaryKey(),
      term: text("term").notNull(),
      reason: text("reason"),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    keywordGroups = pgTable("keyword_groups", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      description: text("description"),
      isActive: boolean("is_active").default(true).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    keywordGroupMappings = pgTable("keyword_group_mappings", {
      id: serial("id").primaryKey(),
      keywordId: integer("keyword_id").references(() => keywords.id, { onDelete: "cascade" }).notNull(),
      groupId: integer("group_id").references(() => keywordGroups.id, { onDelete: "cascade" }).notNull()
    });
    monitorSchedule = pgTable("monitor_schedule", {
      id: serial("id").primaryKey(),
      enabled: boolean("enabled").default(false).notNull(),
      frequency: text("frequency").default("daily").notNull(),
      time: text("time").default("00:00").notNull(),
      days: text("days").array(),
      sources: text("sources").array(),
      lastRun: timestamp("last_run"),
      nextRun: timestamp("next_run"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    monitorResults = pgTable("monitor_results", {
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
      notes: text("notes")
    });
    insertKeywordSchema = createInsertSchema(keywords).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      lastSearched: true,
      matchCount: true
    });
    insertExcludedKeywordSchema = createInsertSchema(excludedKeywords).omit({ id: true, createdAt: true });
    insertKeywordGroupSchema = createInsertSchema(keywordGroups).omit({ id: true, createdAt: true });
    insertKeywordGroupMappingSchema = createInsertSchema(keywordGroupMappings).omit({ id: true });
    insertMonitorResultSchema = createInsertSchema(monitorResults).omit({
      id: true,
      foundAt: true,
      reviewedAt: true
    });
    insertMonitorScheduleSchema = createInsertSchema(monitorSchedule).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      lastRun: true,
      nextRun: true
    });
    tags = pgTable("tags", {
      id: serial("id").primaryKey(),
      name: text("name").notNull().unique(),
      slug: text("slug").notNull().unique(),
      description: text("description"),
      category: text("category").notNull(),
      // health_condition, body_system, methodology, outcome, etc.
      color: text("color"),
      // For UI display
      usageCount: integer("usage_count").default(0),
      isSystemGenerated: boolean("is_system_generated").default(true),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull()
    });
    studyTags = pgTable("study_tags", {
      id: serial("id").primaryKey(),
      studyId: integer("study_id").references(() => studies.id, { onDelete: "cascade" }).notNull(),
      tagId: integer("tag_id").references(() => tags.id, { onDelete: "cascade" }).notNull(),
      confidence: integer("confidence").default(100),
      // AI confidence score 0-100
      source: text("source").notNull(),
      // 'title', 'abstract', 'keywords', 'content', 'manual'
      createdAt: timestamp("created_at").defaultNow().notNull()
    }, (table) => {
      return {
        uniqueStudyTag: unique().on(table.studyId, table.tagId),
        studyIdx: index("study_tags_study_idx").on(table.studyId),
        tagIdx: index("study_tags_tag_idx").on(table.tagId)
      };
    });
    tagCategories = pgTable("tag_categories", {
      id: serial("id").primaryKey(),
      name: text("name").notNull().unique(),
      slug: text("slug").notNull().unique(),
      description: text("description"),
      color: text("color"),
      sortOrder: integer("sort_order").default(0),
      isActive: boolean("is_active").default(true),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    tagSynonyms = pgTable("tag_synonyms", {
      id: serial("id").primaryKey(),
      tagId: integer("tag_id").references(() => tags.id, { onDelete: "cascade" }).notNull(),
      synonym: text("synonym").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull()
    }, (table) => {
      return {
        uniqueSynonym: unique().on(table.tagId, table.synonym)
      };
    });
    insertTagSchema = createInsertSchema(tags).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      usageCount: true
    });
    insertStudyTagSchema = createInsertSchema(studyTags).omit({
      id: true,
      createdAt: true
    });
    insertTagCategorySchema = createInsertSchema(tagCategories).omit({
      id: true,
      createdAt: true
    });
    insertTagSynonymSchema = createInsertSchema(tagSynonyms).omit({
      id: true,
      createdAt: true
    });
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  db: () => db,
  pool: () => pool
});
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
var pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    neonConfig.webSocketConstructor = ws;
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?"
      );
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      // Maximum number of connections
      min: 5,
      // Minimum number of connections
      idleTimeoutMillis: 3e4,
      // Close idle connections after 30s
      connectionTimeoutMillis: 5e3,
      // Timeout for new connections
      maxUses: 7500,
      // Close connections after 7500 uses
      allowExitOnIdle: false
      // Keep pool alive
    });
    db = drizzle(pool, {
      schema: schema_exports,
      logger: process.env.NODE_ENV === "development" ? false : void 0
      // Disable logging in production
    });
  }
});

// server/production-server.ts
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { neon } from "@neondatabase/serverless";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
async function createProductionServer() {
  const app = express();
  const startTime = Date.now();
  console.log("Initializing production server...");
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for production");
  }
  const sql = neon(process.env.DATABASE_URL);
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
    } else {
      next();
    }
  });
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  app.use("/assets", express.static(path.join(process.cwd(), "dist", "assets")));
  app.use(express.static(path.join(process.cwd(), "dist")));
  app.use(express.static(path.join(process.cwd(), "public")));
  console.log("Setting up essential API routes...");
  app.get("/api/studies", async (req, res) => {
    try {
      const {
        search = "",
        category = "",
        limit = "50",
        offset = "0"
      } = req.query;
      let baseQuery = sql`SELECT * FROM studies`;
      let conditions = [];
      if (search) {
        conditions.push(sql`(title ILIKE ${"%" + search + "%"} OR abstract ILIKE ${"%" + search + "%"})`);
      }
      if (category) {
        conditions.push(sql`category = ${category}`);
      }
      let studies2;
      if (conditions.length > 0) {
        const whereClause = conditions.reduce((acc, condition) => sql`${acc} AND ${condition}`);
        studies2 = await sql`
          SELECT * FROM studies
          WHERE ${whereClause}
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `;
      } else {
        studies2 = await sql`
          SELECT * FROM studies
          ORDER BY created_at DESC
          LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `;
      }
      res.json(studies2);
    } catch (error) {
      console.error("Error fetching studies:", error);
      res.status(500).json({ error: "Failed to fetch studies" });
    }
  });
  app.get("/api/categories", async (req, res) => {
    try {
      const categories2 = await sql`
        SELECT category, COUNT(*) as count
        FROM studies
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY count DESC
      `;
      res.json(categories2);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });
  app.get("/api/consumer-categories/counts", async (req, res) => {
    try {
      const consumerCategoriesResults = await sql`
        SELECT consumer_categories, COUNT(*) as count
        FROM studies
        WHERE consumer_categories IS NOT NULL
        AND consumer_categories != ''
        AND consumer_categories != 'null'
        GROUP BY consumer_categories
      `;
      const bodySystemsMap = /* @__PURE__ */ new Map();
      const conditionsMap = /* @__PURE__ */ new Map();
      const lifeStagesMap = /* @__PURE__ */ new Map();
      consumerCategoriesResults.forEach((row) => {
        try {
          const categories2 = JSON.parse(row.consumer_categories);
          const count = parseInt(row.count);
          if (categories2.bodySystem && Array.isArray(categories2.bodySystem)) {
            categories2.bodySystem.forEach((bs) => {
              bodySystemsMap.set(bs, (bodySystemsMap.get(bs) || 0) + count);
            });
          }
          if (categories2.condition && Array.isArray(categories2.condition)) {
            categories2.condition.forEach((cond) => {
              conditionsMap.set(cond, (conditionsMap.get(cond) || 0) + count);
            });
          }
          if (categories2.lifeStage && Array.isArray(categories2.lifeStage)) {
            categories2.lifeStage.forEach((ls) => {
              lifeStagesMap.set(ls, (lifeStagesMap.get(ls) || 0) + count);
            });
          }
        } catch (e) {
          console.log("Skipping invalid JSON:", row.consumer_categories);
        }
      });
      const data = {
        condition: Array.from(conditionsMap.entries()).map(([name, count]) => ({ name, count: count.toString() })),
        bodySystem: Array.from(bodySystemsMap.entries()).map(([name, count]) => ({ name, count: count.toString() })),
        lifeStage: Array.from(lifeStagesMap.entries()).map(([name, count]) => ({ name, count: count.toString() }))
      };
      res.json({ data });
    } catch (error) {
      console.error("Error fetching consumer categories:", error);
      res.status(500).json({ error: "Failed to fetch consumer categories" });
    }
  });
  app.get(
    "/api/categories",
    async (req, res) => {
      try {
        const { pool: pool2 } = await Promise.resolve().then(() => (init_db(), db_exports));
        const result = await pool2.query(`
        SELECT DISTINCT c.id, c.name, c.description, 
               COUNT(sc.study_id) as study_count
        FROM categories c
        LEFT JOIN study_categories sc ON c.id = sc.category_id
        GROUP BY c.id, c.name, c.description
        ORDER BY study_count DESC
        LIMIT 20
      `);
        const categories2 = result.rows.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description || `${row.study_count} studies available`,
          icon: "flask",
          count: parseInt(row.study_count)
        }));
        return res.json(categories2);
      } catch (error) {
        console.error("Categories error:", error);
        return res.status(500).json({
          error: "Failed to fetch categories"
        });
      }
    }
  );
  app.get("/api/search", async (req, res) => {
    try {
      const { q, limit = 20, offset = 0 } = req.query;
      if (!q || typeof q !== "string") {
        return res.status(400).json({
          success: false,
          error: "Search query is required"
        });
      }
      const { pool: pool2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const searchQuery = `%${q.toLowerCase()}%`;
      const result = await pool2.query(`
        SELECT id, title, abstract, authors, journal, publish_date as "publishDate", 
               category, doi, image_url as "imageUrl", slug
        FROM studies 
        WHERE LOWER(title) LIKE $1 OR LOWER(abstract) LIKE $2
        ORDER BY 
          CASE 
            WHEN LOWER(title) LIKE $3 THEN 1
            WHEN LOWER(abstract) LIKE $4 THEN 2
            ELSE 3
          END,
          publish_date DESC
        LIMIT $5 OFFSET $6
      `, [searchQuery, searchQuery, searchQuery, searchQuery, limit, offset]);
      const countResult = await pool2.query(`
        SELECT COUNT(*) as total
        FROM studies 
        WHERE LOWER(title) LIKE $1 OR LOWER(abstract) LIKE $2
      `, [searchQuery, searchQuery]);
      return res.json({
        success: true,
        studies: result.rows,
        total: parseInt(countResult.rows[0].total),
        hasMore: parseInt(offset) + result.rows.length < parseInt(countResult.rows[0].total)
      });
    } catch (error) {
      console.error("Search error:", error);
      return res.status(500).json({
        success: false,
        error: "Search failed"
      });
    }
  });
  app.get("/api/consumer-categories/studies", async (req, res) => {
    try {
      const { model, category, limit = "20", offset = "0" } = req.query;
      if (!model || !category) {
        return res.status(400).json({ error: "Model and category are required" });
      }
      let studies2;
      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);
      if (model === "condition") {
        studies2 = await sql`
          SELECT * FROM studies
          WHERE consumer_categories IS NOT NULL
          AND consumer_categories != ''
          AND consumer_categories != 'null'
          AND consumer_categories LIKE ${'%"condition":[%' + category + "%"}
          ORDER BY created_at DESC
          LIMIT ${limitNum} OFFSET ${offsetNum}
        `;
      } else if (model === "bodySystem") {
        studies2 = await sql`
          SELECT * FROM studies
          WHERE consumer_categories IS NOT NULL
          AND consumer_categories != ''
          AND consumer_categories != 'null'
          AND consumer_categories LIKE ${'%"bodySystem":[%' + category + "%"}
          ORDER BY created_at DESC
          LIMIT ${limitNum} OFFSET ${offsetNum}
        `;
      } else if (model === "lifeStage") {
        studies2 = await sql`
          SELECT * FROM studies
          WHERE consumer_categories IS NOT NULL
          AND consumer_categories != ''
          AND consumer_categories != 'null'
          AND consumer_categories LIKE ${'%"lifeStage":[%' + category + "%"}
          ORDER BY created_at DESC
          LIMIT ${limitNum} OFFSET ${offsetNum}
        `;
      } else {
        return res.status(400).json({ error: "Invalid model type" });
      }
      res.json(studies2);
    } catch (error) {
      console.error("Error fetching consumer category studies:", error);
      res.status(500).json({ error: "Failed to fetch studies for category" });
    }
  });
  console.log("\u2713 Essential API routes configured");
  app.get("/health", (req, res) => {
    res.json({ status: "healthy", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/api", (req, res) => {
    res.json({
      name: "Hydrogen Research Platform API",
      version: "1.0.0",
      status: "running",
      endpoints: ["/api/studies", "/api/search", "/api/categories", "/health"]
    });
  });
  app.get("*", (req, res) => {
    const distIndexPath = path.join(process.cwd(), "dist", "index.html");
    const publicIndexPath = path.join(process.cwd(), "public", "index.html");
    if (existsSync(distIndexPath)) {
      res.sendFile(distIndexPath);
    } else {
      res.sendFile(publicIndexPath);
    }
  });
  app.use((error, req, res, next) => {
    console.error("Production server error:", error);
    if (res.headersSent) {
      return next(error);
    }
    res.status(500).json({
      error: "Internal server error",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  const port = parseInt(process.env.PORT || "5000");
  const server = createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(port, "0.0.0.0", () => {
      const duration = Date.now() - startTime;
      console.log(`\u2713 Production server running on port ${port} (${duration}ms startup)`);
      resolve({ app, server });
    });
    server.on("error", reject);
  });
}
if (process.argv[1] === __filename) {
  createProductionServer().catch(console.error);
}
export {
  createProductionServer
};
