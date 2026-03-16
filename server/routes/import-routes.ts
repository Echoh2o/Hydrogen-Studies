import express, { Request, Response } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { studyService } from "../services/study-service";
import { InsertStudy } from "@shared/schema";
import path from "path";
import fs from "fs";
import axios from "axios";

const router = express.Router();

// Configure multer for file uploads
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

const upload = multer({ storage });

// Helper function to clean up temporary files
function cleanupTempFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Error cleaning up temporary file ${filePath}:`, error);
  }
}

// Helper function to convert an ExcelJS worksheet to an array of row objects
function worksheetToJson(worksheet: ExcelJS.Worksheet): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  const headers: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // First row is headers
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || "").trim();
      });
    } else {
      const obj: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          obj[header] = cell.value;
        }
      });
      if (Object.keys(obj).length > 0) {
        rows.push(obj);
      }
    }
  });

  return rows;
}

// Helper function to process workbook data
function processWorkbookData(data: Record<string, any>[]): InsertStudy[] {
  return data.map((row: any) => ({
    title: String(row.Title || row.title || ""),
    abstract: String(row.Abstract || row.abstract || ""),
    authors: String(
      row.Authors ||
        row.authors ||
        row["First Author"] ||
        row.firstAuthor ||
        "",
    ),
    journal: String(row.Journal || row.journal || ""),
    publishDate: String(
      row["Publish Date"] ||
        row.publishDate ||
        row.Year ||
        row.year ||
        new Date().toISOString(),
    ),
    doi: String(row.DOI || row.doi || ""),
    category: String(
      row.Category ||
        row.category ||
        row["Primary Topic"] ||
        row.primaryTopic ||
        "General",
    ),
    methods: String(row.Methods || row.methods || ""),
    results: String(row.Results || row.results || ""),
    conclusion: String(row.Conclusion || row.conclusion || ""),
    keyFindings: String(row["Key Findings"] || row.keyFindings || ""),
    healthConditions: String(row["Health Conditions"] || row.healthConditions || "").split(",").map((s: string) => s.trim()).filter(Boolean),
    bodySystems: String(row["Body Systems"] || row.bodySystems || "").split(",").map((s: string) => s.trim()).filter(Boolean),
    sampleSize: parseInt(row["Sample Size"] || row.sampleSize || "0") || undefined,
    imageUrl: String(row["Image URL"] || row.imageUrl || ""),
    pdfUrl: String(row["PDF URL"] || row.pdfUrl || ""),
    status: "published",
    studyType: String(row["Study Type"] || row.studyType || "clinical"),
    country: String(row.Country || row.country || ""),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

// Excel import route
router.post(
  "/excel",
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const filePath = req.file.path;

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error("No worksheet found in file");

      const data = worksheetToJson(worksheet);
      const studies = processWorkbookData(data);

      // Import studies to database
      const results = await importStudiesToDatabase(studies);

      // Clean up temp file
      cleanupTempFile(filePath);

      return res.json({
        total: studies.length,
        ...results,
        success: true,
      });
    } catch (error) {
      console.error("Excel import error:", error);

      // Clean up temp file
      cleanupTempFile(filePath);

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to import Excel file",
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
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const filePath = req.file.path;

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.csv.readFile(filePath);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error("No worksheet found in CSV");

      const data = worksheetToJson(worksheet);
      const studies = processWorkbookData(data);

      // Import studies to database
      const results = await importStudiesToDatabase(studies);

      // Clean up temp file
      cleanupTempFile(filePath);

      return res.json({
        total: studies.length,
        ...results,
        success: true,
      });
    } catch (error) {
      console.error("CSV import error:", error);

      // Clean up temp file
      cleanupTempFile(filePath);

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to import CSV file",
      });
    }
  },
);

// Google Sheets import route
router.post("/googlesheet", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res
        .status(400)
        .json({ success: false, message: "No Google Sheet URL provided" });
    }

    // Extract the sheet ID from the URL
    const urlPattern =
      /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)\/edit/;
    const match = url.match(urlPattern);

    if (!match || !match[1]) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid Google Sheet URL. Please use a URL in the format: https://docs.google.com/spreadsheets/d/SHEET_ID/edit",
      });
    }

    const sheetId = match[1];

    // Get the Google Sheet as CSV
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    const response = await axios.get(csvUrl, { responseType: "arraybuffer" });

    // Write response to a temporary file
    const tempFilePath = path.join(
      process.cwd(),
      "temp_files",
      `gsheet-${Date.now()}.csv`,
    );

    // Create the directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), "temp_files");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    try {
      fs.writeFileSync(tempFilePath, Buffer.from(response.data));
      const workbook = new ExcelJS.Workbook();
      await workbook.csv.readFile(tempFilePath);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error("No worksheet found in Google Sheet CSV");

      const data = worksheetToJson(worksheet);
      const studies = processWorkbookData(data);

      // Import studies to database
      const results = await importStudiesToDatabase(studies);

      // Clean up temp file
      cleanupTempFile(tempFilePath);

      return res.json({
        total: studies.length,
        ...results,
        success: true,
      });
    } catch (fileErr) {
      cleanupTempFile(tempFilePath);
      return res.status(500).json({
        success: false,
        message: `File processing failed: ${fileErr instanceof Error ? fileErr.message : "Unknown error"}`,
      });
    }
  } catch (error) {
    console.error("Google Sheet import error:", error);

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to import from Google Sheet",
    });
  }
});

// Helper function to import studies to database
async function importStudiesToDatabase(studies: InsertStudy[]) {
  let success = 0;
  let failures = 0;
  const errors: string[] = [];

  for (const study of studies) {
    try {
      // Skip empty titles
      if (!study.title.trim()) {
        failures++;
        errors.push("Skipped study with empty title");
        continue;
      }

      // Insert study to database
      await studyService.createStudy(study);
      success++;
    } catch (error) {
      failures++;
      errors.push(error instanceof Error ? error.message : "Unknown error");
      console.error(`Failed to import study: ${study.title}`, error);
    }
  }

  return {
    success,
    failures,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Export import routes
export default router;
