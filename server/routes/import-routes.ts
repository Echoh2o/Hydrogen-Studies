import express, { Request, Response } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import slugify from "slugify";
import { studyService } from "../services/study-service";
import { InsertStudy } from "@shared/schema";
import path from "path";
import fs from "fs";
import axios from "axios";
import { logger } from "../utils/logger";

const router = express.Router();

// Configure multer for file uploads with 10MB limit
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "temp_files");

    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniquePrefix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniquePrefix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Helper function to clean up temporary files
function cleanupTempFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    logger.error(`Error cleaning up temporary file ${filePath}`, error, "ImportRoutes");
  }
}

// Helper: return trimmed string or null for optional fields
function strOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

// Helper: pick first truthy value from a row using multiple possible column names
function pick(row: Record<string, any>, ...keys: string[]): any {
  for (const key of keys) {
    if (row[key] !== null && row[key] !== undefined && row[key] !== "") {
      return row[key];
    }
  }
  return null;
}

// Helper: extract a 4-digit year from a date string, number, or Date object
function extractYear(value: any): number | null {
  if (!value) return null;
  // Already a 4-digit year number
  if (typeof value === "number" && value >= 1900 && value <= 2100) return value;
  const str = String(value);
  // Try to match a 4-digit year
  const match = str.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : null;
}

// Helper: generate a URL-safe slug from a title
function generateSlug(title: string): string {
  const base = slugify(title, { lower: true, strict: true });
  // Append a short timestamp suffix to avoid collisions
  return `${base}-${Date.now()}`;
}

// Helper function to convert an ExcelJS worksheet to an array of row objects
// Handles empty cells by iterating over all header columns for every row
function worksheetToJson(worksheet: ExcelJS.Worksheet): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  const headers: string[] = [];
  let headerCount = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // First row is headers
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || "").trim();
        headerCount = Math.max(headerCount, colNumber);
      });
    } else {
      const obj: Record<string, any> = {};
      let hasData = false;
      // Iterate ALL header columns, not just non-empty cells
      for (let col = 1; col <= headerCount; col++) {
        const header = headers[col];
        if (!header) continue;
        const cell = row.getCell(col);
        // cell.value is null for empty cells — preserve that instead of skipping
        obj[header] = cell.value ?? null;
        if (cell.value !== null && cell.value !== undefined) hasData = true;
      }
      if (hasData) {
        rows.push(obj);
      }
    }
  });

  return rows;
}

// Helper function to process workbook data into InsertStudy objects
function processWorkbookData(data: Record<string, any>[]): InsertStudy[] {
  return data.map((row: any) => {
    const title = String(pick(row, "Title", "title") || "");
    const rawDate = pick(row, "Publish Date", "publishDate", "publish_date", "Date", "date",
      "Publish Year", "Year", "year");
    const publishDate = rawDate ? String(rawDate) : new Date().toISOString();
    const publishYear = extractYear(rawDate);

    // Parse comma-separated arrays, returning empty array (not [""])
    const parseArray = (val: any): string[] => {
      if (!val) return [];
      return String(val).split(",").map((s: string) => s.trim()).filter(Boolean);
    };

    // DOI/PMID/Link column: extract DOI if present, otherwise use as URL
    const doiRaw = strOrNull(pick(row, "DOI", "doi", "DOI/PMID/Link"));
    let doi: string | null = null;
    let url: string | null = strOrNull(pick(row, "URL", "url"));
    if (doiRaw) {
      // If it looks like a DOI (starts with 10. or contains doi.org)
      if (doiRaw.match(/^10\.\d{4,}/) || doiRaw.includes("doi.org")) {
        doi = doiRaw.replace(/https?:\/\/doi\.org\//, "").trim();
      } else if (doiRaw.match(/^\d{7,}$/)) {
        // Pure numeric = PMID — store as URL
        url = url || `https://pubmed.ncbi.nlm.nih.gov/${doiRaw.trim()}`;
      } else if (doiRaw.startsWith("http")) {
        url = url || doiRaw;
      } else {
        // Treat as DOI by default
        doi = doiRaw.trim();
      }
    }

    // Build category from Primary Topic; collect all topics as keywords
    const primaryTopic = strOrNull(pick(row, "Category", "category", "Primary Topic", "primaryTopic"));
    const secondaryTopic = strOrNull(pick(row, "Secondary Topic", "secondaryTopic"));
    const tertiaryTopic = strOrNull(pick(row, "Tertiary Topic", "tertiaryTopic"));
    const topicKeywords = [primaryTopic, secondaryTopic, tertiaryTopic].filter(Boolean) as string[];

    // Model column → studyType (Human, Animal, In Vitro, etc.)
    const model = strOrNull(pick(row, "Model", "model", "Study Type", "studyType", "study_type"));

    // Vehicle column → h2DeliveryMethod
    const vehicle = strOrNull(pick(row, "Vehicle", "vehicle", "Delivery Method", "deliveryMethod"));

    const study: InsertStudy = {
      // Required fields
      title,
      abstract: String(pick(row, "Abstract", "abstract") || ""),
      authors: String(pick(row, "Authors", "authors", "First Author", "firstAuthor") || ""),
      journal: String(pick(row, "Journal", "journal") || ""),
      publishDate,
      category: primaryTopic || "General",
      // Optional string fields — null instead of ""
      methods: strOrNull(pick(row, "Methods", "methods")),
      results: strOrNull(pick(row, "Results", "results")),
      conclusion: strOrNull(pick(row, "Conclusion", "conclusion")),
      keyFinding: strOrNull(pick(row, "Key Findings", "keyFindings", "Key Finding", "keyFinding")),
      doi,
      url,
      imageUrl: strOrNull(pick(row, "Image URL", "imageUrl", "image_url")),
      pdfUrl: strOrNull(pick(row, "PDF URL", "pdfUrl", "pdf_url")),
      country: strOrNull(pick(row, "Country", "country")),
      studyType: model || "clinical",
      isHumanTrial: model ? /human/i.test(model) : false,
      h2DeliveryMethod: vehicle,
      // TLDR and summary from spreadsheet
      tldr: strOrNull(pick(row, "TLDR", "tldr", "TL;DR")),
      plainSummary: strOrNull(pick(row, "Summary", "summary", "Plain Summary")),
      // Outcome / rank
      outcome: strOrNull(pick(row, "Rank", "rank", "Outcome", "outcome")),
      // Numeric fields
      publishYear,
      sampleSize: parseInt(pick(row, "Sample Size", "sampleSize", "sample_size") || "0") || null,
      // Array fields
      keywords: topicKeywords.length > 0 ? topicKeywords : [],
      healthConditions: parseArray(pick(row, "Health Conditions", "healthConditions", "health_conditions")),
      bodySystems: parseArray(pick(row, "Body Systems", "bodySystems", "body_systems")),
      // Generated fields
      slug: title ? generateSlug(title) : null,
    };

    return study;
  });
}

// Types for analysis results
interface StudyAnalysis {
  study: InsertStudy;
  status: "new" | "duplicate_doi" | "duplicate_title" | "deleted" | "empty" | "batch_duplicate";
  existingId?: number;
  deletedBy?: string | null;
}

interface AnalysisResult {
  totalRows: number;
  readyToImport: number;
  duplicatesByDoi: number;
  duplicatesByTitle: number;
  batchDuplicates: number;
  previouslyDeleted: number;
  emptyTitles: number;
  studies: StudyAnalysis[];
}

// Analyze studies for duplicates and deletions without inserting
async function analyzeStudies(studies: InsertStudy[]): Promise<AnalysisResult> {
  // Phase 1: Intra-batch dedup
  const seenDois = new Map<string, number>(); // doi -> first index
  const seenTitles = new Map<string, number>(); // lowercase title -> first index
  const analyses: StudyAnalysis[] = studies.map((study, idx) => {
    if (!study.title.trim()) return { study, status: "empty" as const };

    const lowerTitle = study.title.toLowerCase().trim();
    const doi = study.doi?.trim() || null;

    // Check intra-batch DOI duplicate
    if (doi && seenDois.has(doi)) {
      return { study, status: "batch_duplicate" as const };
    }
    // Check intra-batch title duplicate
    if (seenTitles.has(lowerTitle)) {
      return { study, status: "batch_duplicate" as const };
    }

    if (doi) seenDois.set(doi, idx);
    seenTitles.set(lowerTitle, idx);

    return { study, status: "new" as const };
  });

  // Collect DOIs and titles from non-batch-duplicate, non-empty studies
  const candidateDois: string[] = [];
  const candidateTitles: string[] = [];
  for (const a of analyses) {
    if (a.status !== "new") continue;
    if (a.study.doi) candidateDois.push(a.study.doi);
    candidateTitles.push(a.study.title.toLowerCase().trim());
  }

  // Phase 2: Batch DB checks (4 queries total instead of N)
  const [existing, deleted] = await Promise.all([
    studyService.batchCheckExistingStudies(candidateDois, candidateTitles),
    studyService.batchCheckDeletedStudies(candidateDois, candidateTitles),
  ]);

  // Phase 3: Classify each candidate
  for (const a of analyses) {
    if (a.status !== "new") continue;

    const doi = a.study.doi?.trim() || null;
    const lowerTitle = a.study.title.toLowerCase().trim();

    // Check deleted first (takes priority — user intentionally removed it)
    if (doi && deleted.doiMap.has(doi)) {
      a.status = "deleted";
      a.deletedBy = deleted.doiMap.get(doi)!.deletedBy;
      continue;
    }
    if (deleted.titleMap.has(lowerTitle)) {
      a.status = "deleted";
      a.deletedBy = deleted.titleMap.get(lowerTitle)!.deletedBy;
      continue;
    }

    // Check existing duplicates
    if (doi && existing.doiMap.has(doi)) {
      a.status = "duplicate_doi";
      a.existingId = existing.doiMap.get(doi);
      continue;
    }
    if (existing.titleMap.has(lowerTitle)) {
      a.status = "duplicate_title";
      a.existingId = existing.titleMap.get(lowerTitle);
      continue;
    }
  }

  const counts = {
    totalRows: studies.length,
    readyToImport: analyses.filter(a => a.status === "new").length,
    duplicatesByDoi: analyses.filter(a => a.status === "duplicate_doi").length,
    duplicatesByTitle: analyses.filter(a => a.status === "duplicate_title").length,
    batchDuplicates: analyses.filter(a => a.status === "batch_duplicate").length,
    previouslyDeleted: analyses.filter(a => a.status === "deleted").length,
    emptyTitles: analyses.filter(a => a.status === "empty").length,
  };

  return { ...counts, studies: analyses };
}

// Shared response builder
function buildResponse(total: number, results: {
  imported: number;
  failed: number;
  skippedDuplicate: number;
  skippedDeleted: number;
  importedStudyIds: number[];
  skippedStudies?: { title: string; deletedBy: string | null }[];
  duplicateStudies?: { title: string; reason: string; existingId?: number }[];
  errors?: string[];
}) {
  return {
    success: true,
    total,
    imported: results.imported,
    failed: results.failed,
    skippedDuplicate: results.skippedDuplicate,
    skippedDeleted: results.skippedDeleted,
    importedStudyIds: results.importedStudyIds,
    skippedStudies: results.skippedStudies,
    duplicateStudies: results.duplicateStudies,
    errors: results.errors,
  };
}

// Helper: parse file into studies array (shared between endpoints)
async function parseFile(filePath: string, format: "xlsx" | "csv"): Promise<InsertStudy[]> {
  const workbook = new ExcelJS.Workbook();
  if (format === "xlsx") {
    await workbook.xlsx.readFile(filePath);
  } else {
    await workbook.csv.readFile(filePath);
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("No worksheet found in file");
  const data = worksheetToJson(worksheet);
  return processWorkbookData(data);
}

// Import studies using pre-computed analysis
async function importWithAnalysis(
  analysis: AnalysisResult,
) {
  let imported = 0;
  let failed = 0;
  const importedStudyIds: number[] = [];
  const errors: string[] = [];
  const skippedStudies: { title: string; deletedBy: string | null }[] = [];
  const duplicateStudies: { title: string; reason: string; existingId?: number }[] = [];

  const newStudies = analysis.studies.filter(a => a.status === "new");
  let processed = 0;

  // Collect skipped info
  for (const a of analysis.studies) {
    if (a.status === "deleted") {
      skippedStudies.push({ title: a.study.title.substring(0, 80), deletedBy: a.deletedBy || null });
    } else if (a.status === "duplicate_doi" || a.status === "duplicate_title") {
      duplicateStudies.push({
        title: a.study.title.substring(0, 80),
        reason: a.status === "duplicate_doi" ? `Duplicate DOI: ${a.study.doi}` : "Duplicate title",
        existingId: a.existingId,
      });
    }
  }

  // Insert only "new" studies
  for (const a of newStudies) {
    try {
      const created = await studyService.createStudy(a.study);
      importedStudyIds.push(created.id);
      imported++;
    } catch (error) {
      failed++;
      errors.push(`"${a.study.title.substring(0, 60)}": ${error instanceof Error ? error.message : "Unknown error"}`);
      logger.error(`Failed to import study: ${a.study.title}`, error, "ImportRoutes");
    }
    processed++;
  }

  return {
    imported,
    failed,
    skippedDuplicate: analysis.duplicatesByDoi + analysis.duplicatesByTitle + analysis.batchDuplicates,
    skippedDeleted: analysis.previouslyDeleted,
    importedStudyIds,
    skippedStudies: skippedStudies.length > 0 ? skippedStudies : undefined,
    duplicateStudies: duplicateStudies.length > 0 ? duplicateStudies : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Analyze endpoint — dry run, no inserts
router.post(
  "/analyze",
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const filePath = req.file.path;
    try {
      const format = req.file.originalname.endsWith(".csv") ? "csv" : "xlsx";
      const studies = await parseFile(filePath, format as "xlsx" | "csv");
      const analysis = await analyzeStudies(studies);
      cleanupTempFile(filePath);

      // Return summary + first 50 sample rows for preview
      const sampleStudies = analysis.studies.slice(0, 50).map(a => ({
        title: a.study.title.substring(0, 100),
        doi: a.study.doi,
        category: a.study.category,
        status: a.status,
        existingId: a.existingId,
      }));

      return res.json({
        success: true,
        totalRows: analysis.totalRows,
        readyToImport: analysis.readyToImport,
        duplicatesByDoi: analysis.duplicatesByDoi,
        duplicatesByTitle: analysis.duplicatesByTitle,
        batchDuplicates: analysis.batchDuplicates,
        previouslyDeleted: analysis.previouslyDeleted,
        emptyTitles: analysis.emptyTitles,
        sampleStudies,
      });
    } catch (error) {
      logger.error("File analysis error", error, "ImportRoutes");
      cleanupTempFile(filePath);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to analyze file",
      });
    }
  },
);

// Excel import route
router.post(
  "/excel",
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const filePath = req.file.path;
    try {
      const studies = await parseFile(filePath, "xlsx");
      const analysis = await analyzeStudies(studies);
      const results = await importWithAnalysis(analysis);
      cleanupTempFile(filePath);
      return res.json(buildResponse(studies.length, results));
    } catch (error) {
      logger.error("Excel import error", error, "ImportRoutes");
      cleanupTempFile(filePath);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to import Excel file",
      });
    }
  },
);

// CSV import route
router.post(
  "/csv",
  upload.single("csvFile"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const filePath = req.file.path;
    try {
      const studies = await parseFile(filePath, "csv");
      const analysis = await analyzeStudies(studies);
      const results = await importWithAnalysis(analysis);
      cleanupTempFile(filePath);
      return res.json(buildResponse(studies.length, results));
    } catch (error) {
      logger.error("CSV import error", error, "ImportRoutes");
      cleanupTempFile(filePath);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to import CSV file",
      });
    }
  },
);

// Google Sheets import route
router.post("/googlesheet", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: "No Google Sheet URL provided" });
    }

    const urlPattern = /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)\/edit/;
    const match = url.match(urlPattern);
    if (!match || !match[1]) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google Sheet URL. Please use a URL in the format: https://docs.google.com/spreadsheets/d/SHEET_ID/edit",
      });
    }

    const sheetId = match[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const response = await axios.get(csvUrl, { responseType: "arraybuffer" });

    const uploadDir = path.join(process.cwd(), "temp_files");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const tempFilePath = path.join(uploadDir, `gsheet-${Date.now()}.csv`);

    try {
      fs.writeFileSync(tempFilePath, Buffer.from(response.data));
      const studies = await parseFile(tempFilePath, "csv");
      const analysis = await analyzeStudies(studies);
      const results = await importWithAnalysis(analysis);
      cleanupTempFile(tempFilePath);
      return res.json(buildResponse(studies.length, results));
    } catch (fileErr) {
      cleanupTempFile(tempFilePath);
      return res.status(500).json({
        success: false,
        message: `File processing failed: ${fileErr instanceof Error ? fileErr.message : "Unknown error"}`,
      });
    }
  } catch (error) {
    logger.error("Google Sheet import error", error, "ImportRoutes");
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to import from Google Sheet",
    });
  }
});

export default router;
