/**
 * WordPress XML Export → Hydrogen Studies Database Importer
 *
 * Parses the WordPress WXR export file and inserts studies into the database.
 * Maps WordPress custom fields, taxonomies, and content to the studies schema.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/import-wordpress-xml.ts [path-to-xml]
 */

import { readFileSync, existsSync } from "fs";
import { db, pool } from "../server/db";
import { studies, type InsertStudy } from "../shared/schema";
import { count } from "drizzle-orm";

// ============================================================
// XML Parsing helpers (no external XML lib needed)
// ============================================================

function extractCDATA(xml: string, tag: string): string {
  // Match <tag><![CDATA[...]]></tag> or <ns:tag><![CDATA[...]]></ns:tag>
  const regex = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function extractCategories(itemXml: string, domain: string): string[] {
  const regex = new RegExp(
    `<category domain="${domain}"[^>]*><!\\[CDATA\\[([^\\]]*?)\\]\\]></category>`,
    "gi"
  );
  const results: string[] = [];
  let match;
  while ((match = regex.exec(itemXml)) !== null) {
    if (match[1].trim()) {
      results.push(match[1].trim());
    }
  }
  return results;
}

function extractMeta(itemXml: string, metaKey: string): string {
  // Match the meta_key/meta_value pairs in wp:postmeta blocks
  const metaRegex = new RegExp(
    `<wp:postmeta>\\s*<wp:meta_key><!\\[CDATA\\[${metaKey}\\]\\]></wp:meta_key>\\s*<wp:meta_value><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></wp:meta_value>\\s*</wp:postmeta>`,
    "i"
  );
  const match = itemXml.match(metaRegex);
  return match ? match[1].trim() : "";
}

// Normalize the `doi_pmid_link` meta into a bare, lowercased DOI so it dedupes
// against DOIs stored by the bulk-doi-import and discovery engine, and so
// citationUrl construction (`https://doi.org/${doi}`) yields a valid link.
// PubMed/PMID links are not DOIs, so return null for them.
function normalizeDoi(raw: string): string | null {
  let value = (raw || "").trim();
  if (!value) return null;
  // PubMed / PMID links are not DOIs — drop them rather than storing a bad DOI.
  if (/pubmed|ncbi\.nlm\.nih\.gov/i.test(value)) return null;
  // Strip a leading doi.org (or dx.doi.org) URL prefix, with or without scheme.
  value = value.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  // Strip a bare "doi:" prefix.
  value = value.replace(/^doi:\s*/i, "");
  value = value.trim().toLowerCase();
  // A real DOI always starts with "10." — anything else isn't a usable DOI.
  if (!value.startsWith("10.")) return null;
  return value;
}

// ============================================================
// Study extraction from WordPress item
// ============================================================

interface WPStudy {
  title: string;
  content: string; // abstract
  slug: string;
  publishDate: string;
  doi: string | null;
  journal: string;
  year: number | null;
  authors: string[];
  country: string;
  bodyPart: string;
  testSubject: string; // human, animal, in vitro
  outcome: string; // positive, neutral, negative
  secondaryTopic: string;
  tertiaryTopic: string;
  application: string;
  vehicle: string;
  ph: string;
  complement: string;
  comparison: string;
  editorsNote: string;
}

function parseItem(itemXml: string): WPStudy | null {
  // Only process "study" post type
  const postType = extractCDATA(itemXml, "wp:post_type");
  if (postType !== "study") return null;

  // Only process published posts
  const status = extractCDATA(itemXml, "wp:status");
  if (status !== "publish") return null;

  const title = extractCDATA(itemXml, "title");
  const content = extractCDATA(itemXml, "content:encoded");
  const slug = extractCDATA(itemXml, "wp:post_name");
  const postDate = extractCDATA(itemXml, "wp:post_date");

  // Custom fields
  const doi = normalizeDoi(extractMeta(itemXml, "doi_pmid_link"));
  const journal = extractMeta(itemXml, "journal");
  const yearStr = extractMeta(itemXml, "year_of_publication");
  const vehicle = extractMeta(itemXml, "vehicle");
  const complement = extractMeta(itemXml, "complement");
  const comparison = extractMeta(itemXml, "comparison");
  const editorsNote = extractMeta(itemXml, "editors_note");

  // Taxonomies
  const authors = extractCategories(itemXml, "article-author");
  const countries = extractCategories(itemXml, "country");
  const bodyParts = extractCategories(itemXml, "body-part");
  const testSubjects = extractCategories(itemXml, "test-subject");
  const outcomes = extractCategories(itemXml, "rank");
  const secondaryTopics = extractCategories(itemXml, "secondary-topic");
  const tertiaryTopics = extractCategories(itemXml, "tertiary-topic");
  const applications = extractCategories(itemXml, "application");
  const phs = extractCategories(itemXml, "ph");
  const years = extractCategories(itemXml, "published-year");

  // Determine year from meta or taxonomy
  let year: number | null = null;
  if (yearStr && !isNaN(parseInt(yearStr))) {
    year = parseInt(yearStr);
  } else if (years.length > 0 && !isNaN(parseInt(years[0]))) {
    year = parseInt(years[0]);
  }

  return {
    title,
    content,
    slug,
    publishDate: postDate || new Date().toISOString().split("T")[0],
    doi,
    journal,
    year,
    authors,
    country: countries[0] || "",
    bodyPart: bodyParts[0] || "",
    testSubject: testSubjects[0] || "",
    outcome: outcomes[0] || "",
    secondaryTopic: secondaryTopics[0] || "",
    tertiaryTopic: tertiaryTopics[0] || "",
    application: applications[0] || "",
    vehicle,
    ph: phs[0] || "",
    complement,
    comparison,
    editorsNote,
  };
}

// ============================================================
// Map WordPress study to database InsertStudy
// ============================================================

function mapStudyType(testSubject: string): string {
  const lower = testSubject.toLowerCase();
  if (lower.includes("human")) return "human";
  if (lower.includes("animal") || lower.includes("rat") || lower.includes("mouse") || lower.includes("mice")) return "animal";
  if (lower.includes("vitro") || lower.includes("cell")) return "in vitro";
  if (lower.includes("review")) return "review";
  return lower || "other";
}

function mapOutcome(rank: string): string {
  const lower = rank.toLowerCase();
  if (lower.includes("positive")) return "positive";
  if (lower.includes("negative")) return "negative";
  if (lower.includes("neutral") || lower.includes("n/a")) return "neutral";
  return "neutral";
}

function mapCategory(secondaryTopic: string, tertiaryTopic: string): string {
  // Map WordPress topics to a general category
  const topic = (secondaryTopic || tertiaryTopic || "general").toLowerCase();

  const categoryMap: Record<string, string> = {
    "excercise": "exercise-performance",
    "exercise": "exercise-performance",
    "performance enhancement": "exercise-performance",
    "fatigue": "exercise-performance",
    "neuroprotection": "neurological",
    "neurological": "neurological",
    "brain": "neurological",
    "cognitive": "neurological",
    "alzheimer": "neurological",
    "parkinson": "neurological",
    "cancer": "cancer",
    "oncology": "cancer",
    "tumor": "cancer",
    "cardiovascular": "cardiovascular",
    "heart": "cardiovascular",
    "cardiac": "cardiovascular",
    "diabetes": "metabolic",
    "metabolic": "metabolic",
    "obesity": "metabolic",
    "inflammation": "inflammation",
    "anti-inflammatory": "inflammation",
    "antioxidant": "antioxidant",
    "oxidative stress": "antioxidant",
    "skin": "dermatology",
    "dermatology": "dermatology",
    "gut": "gastrointestinal",
    "gastrointestinal": "gastrointestinal",
    "liver": "gastrointestinal",
    "kidney": "renal",
    "renal": "renal",
    "lung": "respiratory",
    "respiratory": "respiratory",
    "copd": "respiratory",
    "eye": "ophthalmology",
    "vision": "ophthalmology",
    "dental": "dental",
    "oral": "dental",
    "bone": "musculoskeletal",
    "joint": "musculoskeletal",
    "arthritis": "musculoskeletal",
    "aging": "aging",
    "longevity": "aging",
    "immune": "immunology",
    "allergy": "immunology",
    "reproduction": "reproductive",
    "fertility": "reproductive",
    "radiation": "radiation-protection",
    "wound": "wound-healing",
    "healing": "wound-healing",
    "pain": "pain-management",
    "sepsis": "critical-care",
    "ischemia": "ischemia-reperfusion",
    "organ preservation": "organ-preservation",
    "transplant": "organ-preservation",
    "water quality": "water-science",
    "agriculture": "agriculture",
    "plant": "agriculture",
  };

  for (const [key, category] of Object.entries(categoryMap)) {
    if (topic.includes(key)) return category;
  }

  return secondaryTopic || "general";
}

function wpStudyToInsert(wp: WPStudy): InsertStudy {
  const category = mapCategory(wp.secondaryTopic, wp.tertiaryTopic);
  const studyType = mapStudyType(wp.testSubject);
  const outcome = mapOutcome(wp.outcome);

  // Build journal publish date from year
  let journalPublishDate: string | null = null;
  if (wp.year) {
    journalPublishDate = `${wp.year}-01-01`;
  }

  // Build keywords from topics
  const keywords: string[] = [];
  if (wp.secondaryTopic) keywords.push(wp.secondaryTopic);
  if (wp.tertiaryTopic) keywords.push(wp.tertiaryTopic);
  if (wp.bodyPart && wp.bodyPart !== "Whole Body") keywords.push(wp.bodyPart);
  if (wp.application) keywords.push(wp.application);
  if (wp.vehicle) keywords.push(wp.vehicle);
  if (wp.complement) keywords.push(wp.complement);

  // Build health conditions / body systems from taxonomies
  const bodySystems: string[] = [];
  if (wp.bodyPart) bodySystems.push(wp.bodyPart);

  // Clean abstract - decode HTML entities first, then strip tags, looping to a
  // fixpoint so entity-escaped markup (e.g. `&lt;i&gt;in vivo&lt;/i&gt;`) can't
  // survive as literal tags. Decode &amp; last to avoid resurrecting markup from
  // double-escaped input (`&amp;lt;` stays escaped rather than becoming `<`).
  let abstract = wp.content;
  let previousAbstract: string;
  do {
    previousAbstract = abstract;
    abstract = abstract
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/<[^>]*>/g, "");
  } while (abstract !== previousAbstract);
  abstract = abstract.replace(/&amp;/g, "&").trim();

  return {
    title: wp.title,
    abstract: abstract || "Abstract not available.",
    authors: wp.authors.join(", ") || "Unknown Authors",
    journal: wp.journal || "Scientific Journal",
    publishDate: wp.publishDate.split(" ")[0], // Just the date part
    journalPublishDate,
    publishYear: wp.year,
    category,
    doi: wp.doi || null,
    slug: wp.slug,
    studyType,
    outcome,
    country: wp.country || null,
    peerReviewed: true,
    keywords: keywords.length > 0 ? keywords : null,
    bodySystems: bodySystems.length > 0 ? bodySystems : null,
    tags: [wp.secondaryTopic, wp.tertiaryTopic, wp.application].filter(Boolean),
    citationUrl: wp.doi ? `https://doi.org/${wp.doi}` : null,
    sourcePlatform: "WordPress Import",
    imageUrl: null,
    imageAlt: null,
    pdfUrl: null,
  };
}

// ============================================================
// Main
// ============================================================

async function main() {
  const xmlPath = process.argv[2] || "hydrogenstudies.WordPress.2026-02-20.xml";

  console.log("=".repeat(60));
  console.log("WordPress XML → Hydrogen Studies Database Import");
  console.log(`Reading: ${xmlPath}`);
  console.log("=".repeat(60));

  // Skip gracefully if XML file doesn't exist (e.g. after one-time import)
  if (!existsSync(xmlPath)) {
    console.log("XML file not found — skipping import (already completed).");
    await pool.end();
    return;
  }

  // Read and parse XML
  const xml = readFileSync(xmlPath, "utf-8");

  // Split into items
  const items = xml.split("<item>").slice(1); // Skip everything before first <item>
  console.log(`Found ${items.length} items in XML`);

  // Parse all study items
  const wpStudies: WPStudy[] = [];
  for (const itemXml of items) {
    const study = parseItem(itemXml);
    if (study) {
      wpStudies.push(study);
    }
  }
  console.log(`Parsed ${wpStudies.length} published studies`);

  // Check for existing studies to avoid duplicates
  const existingDois = new Set<string>();
  const existingSlugs = new Set<string>();

  const existing = await db.select({ doi: studies.doi, slug: studies.slug }).from(studies);
  for (const row of existing) {
    if (row.doi) existingDois.add(row.doi);
    if (row.slug) existingSlugs.add(row.slug);
  }
  console.log(`Existing studies in DB: ${existing.length} (${existingDois.size} with DOIs)`);

  // Insert studies
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  const BATCH_SIZE = 50;

  for (let i = 0; i < wpStudies.length; i += BATCH_SIZE) {
    const batch = wpStudies.slice(i, i + BATCH_SIZE);
    const toInsert: InsertStudy[] = [];

    for (const wp of batch) {
      // Skip duplicates by DOI
      if (wp.doi && existingDois.has(wp.doi)) {
        skipped++;
        continue;
      }
      // Skip duplicates by slug
      if (wp.slug && existingSlugs.has(wp.slug)) {
        skipped++;
        continue;
      }

      const insertStudy = wpStudyToInsert(wp);
      toInsert.push(insertStudy);

      // Track to prevent duplicates within this import
      if (wp.doi) existingDois.add(wp.doi);
      if (wp.slug) existingSlugs.add(wp.slug);
    }

    if (toInsert.length === 0) continue;

    try {
      await db.insert(studies).values(
        toInsert.map(s => ({ ...s, createdAt: new Date() }))
      );
      imported += toInsert.length;
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${toInsert.length} studies (total: ${imported})`);
    } catch (err: any) {
      // If batch fails, try one-by-one
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed, retrying individually...`);
      for (const s of toInsert) {
        try {
          await db.insert(studies).values({ ...s, createdAt: new Date() });
          imported++;
        } catch (innerErr: any) {
          failed++;
          const msg = `Failed: "${s.title?.substring(0, 50)}" - ${innerErr.message?.substring(0, 60)}`;
          errors.push(msg);
          console.log(`    ${msg}`);
        }
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("IMPORT COMPLETE");
  console.log(`  Total studies in XML: ${wpStudies.length}`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped (duplicates): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log("=".repeat(60));

  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach(e => console.log(`  - ${e}`));
  }

  // Print sample of imported data
  const sample = await db.select({
    id: studies.id,
    title: studies.title,
    doi: studies.doi,
    year: studies.publishYear,
    category: studies.category,
  }).from(studies).limit(5);

  console.log("\nSample of imported studies:");
  sample.forEach(s => {
    console.log(`  [${s.id}] (${s.year}) ${s.title?.substring(0, 70)}... [${s.category}]`);
  });

  // Final count
  const [{ total }] = await db.select({ total: count() }).from(studies);
  console.log(`\nTotal studies in database: ${total}`);

  await pool.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  pool.end();
  process.exit(1);
});
