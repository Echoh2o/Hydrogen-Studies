/**
 * Export utilities for generating downloadable files
 */

import * as XLSX from "xlsx";
import { Study } from "@shared/schema";

/**
 * Convert studies to Excel workbook
 * @param studies Array of studies to export
 * @returns Excel workbook buffer
 */
export function exportToExcel(studies: Study[]): Buffer {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Convert studies to worksheet format
  const worksheetData = studies.map((study) => ({
    ID: study.id,
    Title: study.title,
    Abstract: study.abstract,
    Authors: study.authors,
    Journal: study.journal,
    "Publication Date": study.publishDate,
    "Journal Publication Date": study.journalPublishDate || "",
    DOI: study.doi || "",
    Category: study.category,
    Methods: study.methods || "",
    Results: study.results || "",
    Conclusion: study.conclusion || "",
    Objective: study.objective || "",
    "Methods Summary": study.methodsShort || "",
    "Results Summary": study.resultsShort || "",
    "Conclusion Summary": study.conclusionShort || "",
    "Sample Size": study.sampleSize || "",
    "PDF URL": study.pdfUrl || "",
    "Study Type": study.studyType || "",
    Country: study.country || "",
    Region: study.region || "",
    "Year Published": study.publishYear || "",
    "Duration (days)": study.duration || "",
    Outcome: study.outcome || "",
    "Has Full Text": study.hasFullText ? "Yes" : "No",
    "Source URL": study.sourceUrl || "",
    "Source Platform": study.sourcePlatform || "",
    "Created At": study.createdAt
      ? new Date(study.createdAt).toISOString()
      : "",
  }));

  // Create worksheet and add to workbook
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Studies");

  // Generate buffer
  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });

  return excelBuffer;
}

/**
 * Convert studies to CSV string
 * @param studies Array of studies to export
 * @returns CSV string
 */
export function exportToCsv(studies: Study[]): string {
  // Convert studies to worksheet format (same as Excel)
  const worksheetData = studies.map((study) => ({
    ID: study.id,
    Title: study.title,
    Abstract: study.abstract,
    Authors: study.authors,
    Journal: study.journal,
    "Publication Date": study.publishDate,
    "Journal Publication Date": study.journalPublishDate || "",
    DOI: study.doi || "",
    Category: study.category,
    Methods: study.methods || "",
    Results: study.results || "",
    Conclusion: study.conclusion || "",
    Objective: study.objective || "",
    "Methods Summary": study.methodsShort || "",
    "Results Summary": study.resultsShort || "",
    "Conclusion Summary": study.conclusionShort || "",
    "Sample Size": study.sampleSize || "",
    "PDF URL": study.pdfUrl || "",
    "Study Type": study.studyType || "",
    Country: study.country || "",
    Region: study.region || "",
    "Year Published": study.publishYear || "",
    "Duration (days)": study.duration || "",
    Outcome: study.outcome || "",
    "Has Full Text": study.hasFullText ? "Yes" : "No",
    "Source URL": study.sourceUrl || "",
    "Source Platform": study.sourcePlatform || "",
    "Created At": study.createdAt
      ? new Date(study.createdAt).toISOString()
      : "",
  }));

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  // Convert to CSV
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

  return csvOutput;
}

/**
 * Convert studies to JSON string
 * @param studies Array of studies to export
 * @returns JSON string
 */
export function exportToJson(studies: Study[]): string {
  // Convert to a more readable format with only essential fields
  const cleanedStudies = studies.map((study) => ({
    id: study.id,
    title: study.title,
    abstract: study.abstract,
    authors: study.authors,
    journal: study.journal,
    publishDate: study.publishDate,
    journalPublishDate: study.journalPublishDate,
    doi: study.doi,
    category: study.category,
    methods: study.methods,
    results: study.results,
    conclusion: study.conclusion,
    objective: study.objective,
    methodsSummary: study.methodsShort,
    resultsSummary: study.resultsShort,
    conclusionSummary: study.conclusionShort,
    sampleSize: study.sampleSize,
    pdfUrl: study.pdfUrl,
    studyType: study.studyType,
    country: study.country,
    region: study.region,
    yearPublished: study.publishYear,
    duration: study.duration,
    outcome: study.outcome,
    hasFullText: study.hasFullText,
    sourceUrl: study.sourceUrl,
    sourcePlatform: study.sourcePlatform,
    createdAt: study.createdAt ? new Date(study.createdAt).toISOString() : null,
  }));

  return JSON.stringify(cleanedStudies, null, 2);
}

/**
 * Generate citation in various formats
 * @param study Study to generate citation for
 * @param format Citation format (APA, MLA, Chicago, etc.)
 * @returns Formatted citation string
 */
export function generateCitation(
  study: Study,
  format: "APA" | "MLA" | "Chicago" | "Harvard" | "Vancouver",
): string {
  const authors = study.authors;
  const year = study.publishDate
    ? new Date(study.publishDate).getFullYear()
    : "n.d.";
  const title = study.title;
  const journal = study.journal || "Unknown Journal";
  const doi = study.doi;

  switch (format) {
    case "APA":
      return `${authors}. (${year}). ${title}. ${journal}. ${doi ? `https://doi.org/${doi}` : ""}`;

    case "MLA":
      return `${authors}. "${title}." ${journal}, ${year}. ${doi ? `DOI: ${doi}` : ""}`;

    case "Chicago":
      return `${authors}. "${title}." ${journal} (${year}). ${doi ? `https://doi.org/${doi}` : ""}`;

    case "Harvard":
      return `${authors} (${year}). ${title}. ${journal}. ${doi ? `Available at: https://doi.org/${doi}` : ""}`;

    case "Vancouver":
      return `${authors}. ${title}. ${journal}. ${year}. ${doi ? `DOI: ${doi}` : ""}`;

    default:
      return `${authors}. (${year}). ${title}. ${journal}.`;
  }
}
