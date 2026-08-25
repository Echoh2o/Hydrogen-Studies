/**
 * Migration: create taxonomy tables + password_reset_tokens.
 *
 * These 12 tables are declared in shared/schema.ts but were never created in
 * production, because the only thing that would have created them was
 * `drizzle-kit push` — which has been failing non-interactively for a long
 * time (it also wants to drop the runtime-managed full-text `search_vector`
 * column and search indexes, so it can never be run unattended against this
 * DB). As a result:
 *   - password reset was broken (auth-routes inserts into password_reset_tokens)
 *   - the study taxonomy ("Explore by mechanism/delivery/demographic/…") had
 *     no backing tables.
 *
 * This migration creates them the way the rest of this project manages schema:
 * an idempotent, versioned boot migration. DDL matches drizzle's generated
 * output (column types, defaults, and constraint names) so a future
 * `drizzle-kit push` sees these tables as already in sync. Foreign keys are
 * inlined and base tables are created before the join tables that reference
 * them, so the whole thing is order-safe and re-runnable.
 */
import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger";

export async function addTaxonomyAndPasswordReset(): Promise<void> {
  // --- password reset (FK -> users) ------------------------------------
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL,
      "token" text NOT NULL,
      "expires_at" timestamp NOT NULL,
      "used_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token"),
      CONSTRAINT "password_reset_tokens_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "password_reset_token_idx" ON "password_reset_tokens" USING btree ("token")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "password_reset_user_id_idx" ON "password_reset_tokens" USING btree ("user_id")`);

  // --- taxonomy base tables (referenced by the join tables below) ------
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "benefits" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "description" text NOT NULL,
      "icon" text,
      "slug" text NOT NULL,
      "display_order" integer DEFAULT 0 NOT NULL,
      "study_count" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "benefits_name_unique" UNIQUE("name"),
      CONSTRAINT "benefits_slug_unique" UNIQUE("slug")
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "delivery_methods" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "description" text NOT NULL,
      "icon" text,
      "slug" text NOT NULL,
      "display_order" integer DEFAULT 0 NOT NULL,
      "study_count" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "delivery_methods_name_unique" UNIQUE("name"),
      CONSTRAINT "delivery_methods_slug_unique" UNIQUE("slug")
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "demographics" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "description" text NOT NULL,
      "icon" text,
      "slug" text NOT NULL,
      "display_order" integer DEFAULT 0 NOT NULL,
      "study_count" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "demographics_name_unique" UNIQUE("name"),
      CONSTRAINT "demographics_slug_unique" UNIQUE("slug")
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "duration_categories" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "description" text NOT NULL,
      "min_days" integer,
      "max_days" integer,
      "display_order" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "duration_categories_name_unique" UNIQUE("name")
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "mechanisms" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "description" text NOT NULL,
      "icon" text,
      "slug" text NOT NULL,
      "display_order" integer DEFAULT 0 NOT NULL,
      "study_count" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "mechanisms_name_unique" UNIQUE("name"),
      CONSTRAINT "mechanisms_slug_unique" UNIQUE("slug")
    )
  `);

  // --- study outcomes (FK -> studies) ----------------------------------
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "study_outcomes" (
      "id" serial PRIMARY KEY NOT NULL,
      "study_id" integer NOT NULL,
      "plain_english_summary" text NOT NULL,
      "key_findings" text[],
      "significance_level" text,
      "outcome_direction" text,
      "confidence_score" integer,
      "clinical_relevance" text,
      "why_it_matters" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "study_outcomes_study_id_unique" UNIQUE("study_id"),
      CONSTRAINT "study_outcomes_study_id_studies_id_fk"
        FOREIGN KEY ("study_id") REFERENCES "public"."studies"("id")
    )
  `);

  // --- study <-> taxonomy join tables (FK -> studies + base tables) ----
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "study_benefits" (
      "study_id" integer NOT NULL,
      "benefit_id" integer NOT NULL,
      CONSTRAINT "study_benefits_study_id_benefit_id_pk" PRIMARY KEY("study_id","benefit_id"),
      CONSTRAINT "study_benefits_study_id_studies_id_fk"
        FOREIGN KEY ("study_id") REFERENCES "public"."studies"("id") ON DELETE cascade,
      CONSTRAINT "study_benefits_benefit_id_benefits_id_fk"
        FOREIGN KEY ("benefit_id") REFERENCES "public"."benefits"("id")
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "study_delivery_methods" (
      "study_id" integer NOT NULL,
      "delivery_method_id" integer NOT NULL,
      CONSTRAINT "study_delivery_methods_study_id_delivery_method_id_pk" PRIMARY KEY("study_id","delivery_method_id"),
      CONSTRAINT "study_delivery_methods_study_id_studies_id_fk"
        FOREIGN KEY ("study_id") REFERENCES "public"."studies"("id") ON DELETE cascade,
      CONSTRAINT "study_delivery_methods_delivery_method_id_delivery_methods_id_fk"
        FOREIGN KEY ("delivery_method_id") REFERENCES "public"."delivery_methods"("id")
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "study_demographics" (
      "study_id" integer NOT NULL,
      "demographic_id" integer NOT NULL,
      CONSTRAINT "study_demographics_study_id_demographic_id_pk" PRIMARY KEY("study_id","demographic_id"),
      CONSTRAINT "study_demographics_study_id_studies_id_fk"
        FOREIGN KEY ("study_id") REFERENCES "public"."studies"("id") ON DELETE cascade,
      CONSTRAINT "study_demographics_demographic_id_demographics_id_fk"
        FOREIGN KEY ("demographic_id") REFERENCES "public"."demographics"("id")
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "study_durations" (
      "study_id" integer NOT NULL,
      "duration_category_id" integer NOT NULL,
      CONSTRAINT "study_durations_study_id_duration_category_id_pk" PRIMARY KEY("study_id","duration_category_id"),
      CONSTRAINT "study_durations_study_id_studies_id_fk"
        FOREIGN KEY ("study_id") REFERENCES "public"."studies"("id") ON DELETE cascade,
      CONSTRAINT "study_durations_duration_category_id_duration_categories_id_fk"
        FOREIGN KEY ("duration_category_id") REFERENCES "public"."duration_categories"("id")
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "study_mechanisms" (
      "study_id" integer NOT NULL,
      "mechanism_id" integer NOT NULL,
      CONSTRAINT "study_mechanisms_study_id_mechanism_id_pk" PRIMARY KEY("study_id","mechanism_id"),
      CONSTRAINT "study_mechanisms_study_id_studies_id_fk"
        FOREIGN KEY ("study_id") REFERENCES "public"."studies"("id") ON DELETE cascade,
      CONSTRAINT "study_mechanisms_mechanism_id_mechanisms_id_fk"
        FOREIGN KEY ("mechanism_id") REFERENCES "public"."mechanisms"("id")
    )
  `);

  logger.info(
    "Ensured taxonomy tables (benefits, delivery_methods, demographics, duration_categories, mechanisms), " +
      "join tables, study_outcomes, and password_reset_tokens",
    "Migration",
  );
}
