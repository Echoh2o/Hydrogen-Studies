// @ts-nocheck - drizzle-zod generates types incompatible with zod@3.25+ (v4 internals)
import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { studies } from "./schema";

// Benefits table schema (e.g., pain relief, brain health, skin, energy, etc.)
export const benefits = pgTable("benefits", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  icon: text("icon"),
  slug: text("slug").notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
  studyCount: integer("study_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Study benefits mapping table
export const studyBenefits = pgTable(
  "study_benefits",
  {
    studyId: integer("study_id")
      .notNull()
      .references(() => studies.id, { onDelete: "cascade" }),
    benefitId: integer("benefit_id")
      .notNull()
      .references(() => benefits.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.studyId, table.benefitId] }),
    };
  },
);

// Demographics table schema (men, women, children, athletes, elderly)
export const demographics = pgTable("demographics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  icon: text("icon"),
  slug: text("slug").notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
  studyCount: integer("study_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Study demographics mapping table
export const studyDemographics = pgTable(
  "study_demographics",
  {
    studyId: integer("study_id")
      .notNull()
      .references(() => studies.id, { onDelete: "cascade" }),
    demographicId: integer("demographic_id")
      .notNull()
      .references(() => demographics.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.studyId, table.demographicId] }),
    };
  },
);

// Mechanisms table schema (antioxidant, anti-inflammatory, mitochondrial, apoptosis-regulation)
export const mechanisms = pgTable("mechanisms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  icon: text("icon"),
  slug: text("slug").notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
  studyCount: integer("study_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Study mechanisms mapping table
export const studyMechanisms = pgTable(
  "study_mechanisms",
  {
    studyId: integer("study_id")
      .notNull()
      .references(() => studies.id, { onDelete: "cascade" }),
    mechanismId: integer("mechanism_id")
      .notNull()
      .references(() => mechanisms.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.studyId, table.mechanismId] }),
    };
  },
);

// Delivery methods table schema (inhalation, drinking water, bathing, IV, tablet)
export const deliveryMethods = pgTable("delivery_methods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  icon: text("icon"),
  slug: text("slug").notNull().unique(),
  displayOrder: integer("display_order").notNull().default(0),
  studyCount: integer("study_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Study delivery methods mapping table
export const studyDeliveryMethods = pgTable(
  "study_delivery_methods",
  {
    studyId: integer("study_id")
      .notNull()
      .references(() => studies.id, { onDelete: "cascade" }),
    deliveryMethodId: integer("delivery_method_id")
      .notNull()
      .references(() => deliveryMethods.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.studyId, table.deliveryMethodId] }),
    };
  },
);

// Study duration categorization (acute, chronic, long-term follow-up)
export const durationCategories = pgTable("duration_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  minDays: integer("min_days"), // Optional minimum days for this category
  maxDays: integer("max_days"), // Optional maximum days for this category
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Study duration mapping table
export const studyDurations = pgTable(
  "study_durations",
  {
    studyId: integer("study_id")
      .notNull()
      .references(() => studies.id, { onDelete: "cascade" }),
    durationCategoryId: integer("duration_category_id")
      .notNull()
      .references(() => durationCategories.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.studyId, table.durationCategoryId] }),
    };
  },
);

// Study results interpretation for consumer-friendly display
export const studyOutcomes = pgTable("study_outcomes", {
  id: serial("id").primaryKey(),
  studyId: integer("study_id")
    .notNull()
    .references(() => studies.id)
    .unique(),
  plainEnglishSummary: text("plain_english_summary").notNull(),
  keyFindings: text("key_findings").array(),
  significanceLevel: text("significance_level"), // "significant", "trending", "inconclusive"
  outcomeDirection: text("outcome_direction"), // "positive", "negative", "neutral", "mixed"
  confidenceScore: integer("confidence_score"), // 1-5 rating of scientific confidence
  clinicalRelevance: text("clinical_relevance"), // "established", "promising", "preliminary", "speculative"
  whyItMatters: text("why_it_matters"), // Consumer-friendly explanation of relevance
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Create insertion schemas
export const insertBenefitSchema = createInsertSchema(benefits).omit({
  id: true,
  createdAt: true,
});
export const insertStudyBenefitSchema = createInsertSchema(studyBenefits);
export const insertDemographicSchema = createInsertSchema(demographics).omit({
  id: true,
  createdAt: true,
});
export const insertStudyDemographicSchema =
  createInsertSchema(studyDemographics);
export const insertMechanismSchema = createInsertSchema(mechanisms).omit({
  id: true,
  createdAt: true,
});
export const insertStudyMechanismSchema = createInsertSchema(studyMechanisms);
export const insertDeliveryMethodSchema = createInsertSchema(
  deliveryMethods,
).omit({ id: true, createdAt: true });
export const insertStudyDeliveryMethodSchema =
  createInsertSchema(studyDeliveryMethods);
export const insertDurationCategorySchema = createInsertSchema(
  durationCategories,
).omit({ id: true, createdAt: true });
export const insertStudyDurationSchema = createInsertSchema(studyDurations);
export const insertStudyOutcomeSchema = createInsertSchema(studyOutcomes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for insertion
export type InsertBenefit = z.infer<typeof insertBenefitSchema>;
export type InsertStudyBenefit = z.infer<typeof insertStudyBenefitSchema>;
export type InsertDemographic = z.infer<typeof insertDemographicSchema>;
export type InsertStudyDemographic = z.infer<
  typeof insertStudyDemographicSchema
>;
export type InsertMechanism = z.infer<typeof insertMechanismSchema>;
export type InsertStudyMechanism = z.infer<typeof insertStudyMechanismSchema>;
export type InsertDeliveryMethod = z.infer<typeof insertDeliveryMethodSchema>;
export type InsertStudyDeliveryMethod = z.infer<
  typeof insertStudyDeliveryMethodSchema
>;
export type InsertDurationCategory = z.infer<
  typeof insertDurationCategorySchema
>;
export type InsertStudyDuration = z.infer<typeof insertStudyDurationSchema>;
export type InsertStudyOutcome = z.infer<typeof insertStudyOutcomeSchema>;

// Types for selection
export type Benefit = typeof benefits.$inferSelect;
export type StudyBenefit = typeof studyBenefits.$inferSelect;
export type Demographic = typeof demographics.$inferSelect;
export type StudyDemographic = typeof studyDemographics.$inferSelect;
export type Mechanism = typeof mechanisms.$inferSelect;
export type StudyMechanism = typeof studyMechanisms.$inferSelect;
export type DeliveryMethod = typeof deliveryMethods.$inferSelect;
export type StudyDeliveryMethod = typeof studyDeliveryMethods.$inferSelect;
export type DurationCategory = typeof durationCategories.$inferSelect;
export type StudyDuration = typeof studyDurations.$inferSelect;
export type StudyOutcome = typeof studyOutcomes.$inferSelect;
