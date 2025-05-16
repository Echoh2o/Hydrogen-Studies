import fs from 'fs';
import { parse as csvParse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { storage } from './storage';
import { InsertStudy } from '@shared/schema';

/**
 * Imports studies from a JSON file
 * @param filePath Path to the JSON file
 */
export async function importStudiesFromJson(filePath: string): Promise<{total: number, success: number}> {
  try {
    // Read JSON file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const studies = JSON.parse(fileContent);
    
    if (!Array.isArray(studies)) {
      throw new Error('Invalid JSON format. Expected an array of studies.');
    }
    
    return await importStudies(studies);
  } catch (error) {
    console.error(`Error importing studies from JSON: ${error.message}`);
    throw error;
  }
}

/**
 * Imports studies from a CSV file
 * @param filePath Path to the CSV file
 */
export async function importStudiesFromCsv(filePath: string): Promise<{total: number, success: number}> {
  try {
    // Read CSV file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Parse CSV
    const records = csvParse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    if (!Array.isArray(records)) {
      throw new Error('Invalid CSV format. Expected rows of study data.');
    }
    
    return await importStudies(records);
  } catch (error) {
    console.error(`Error importing studies from CSV: ${error.message}`);
    throw error;
  }
}

/**
 * Imports studies from an Excel file (XLSX)
 * @param filePath Path to the Excel file
 */
export async function importStudiesFromExcel(filePath: string): Promise<{total: number, success: number}> {
  try {
    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    
    // Get the first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const records = XLSX.utils.sheet_to_json(worksheet);
    
    if (!Array.isArray(records)) {
      throw new Error('Invalid Excel format. Expected rows of study data.');
    }
    
    return await importStudies(records);
  } catch (error) {
    console.error(`Error importing studies from Excel: ${error.message}`);
    throw error;
  }
}

/**
 * Imports studies from Google Sheets
 * @param sheetUrl URL to the Google Sheet (must be publicly accessible or shared)
 */
export async function importStudiesFromGoogleSheets(sheetUrl: string): Promise<{total: number, success: number}> {
  try {
    // Extract sheet ID from URL (various Google Sheets URL formats)
    let sheetId = '';
    const urlMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      sheetId = urlMatch[1];
    } else {
      throw new Error('Invalid Google Sheets URL. Could not extract sheet ID.');
    }
    
    // Google Sheets export URL (exports as CSV)
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    
    // Fetch the sheet data
    const response = await axios.get(exportUrl);
    const csvData = response.data;
    
    // Parse CSV
    const records = csvParse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    if (!Array.isArray(records)) {
      throw new Error('Invalid Google Sheets data. Expected rows of study data.');
    }
    
    return await importStudies(records);
  } catch (error) {
    console.error(`Error importing studies from Google Sheets: ${error.message}`);
    throw error;
  }
}

/**
 * Import studies into the database
 * @param studies Array of studies to import
 */
async function importStudies(studies: any[]): Promise<{total: number, success: number}> {
  let successCount = 0;
  
  for (const rawStudy of studies) {
    try {
      // Transform and validate study data
      const study: InsertStudy = {
        title: rawStudy.title || '',
        abstract: rawStudy.abstract || '',
        authors: rawStudy.authors || '',
        journal: rawStudy.journal || '',
        publishDate: formatDate(rawStudy.publishDate || new Date().toISOString()),
        category: rawStudy.category || 'General',
        methods: rawStudy.methods || '',
        results: rawStudy.results || '',
        conclusion: rawStudy.conclusion || '',
        doi: rawStudy.doi || '',
        pdfUrl: rawStudy.pdfUrl || '',
        citationUrl: rawStudy.citationUrl || '',
        peerReviewed: parseBooleanValue(rawStudy.peerReviewed)
      };
      
      // Skip studies with missing required fields
      if (!study.title || !study.abstract) {
        console.log(`Skipping study with missing required fields: ${study.title || 'Untitled'}`);
        continue;
      }
      
      // Check if a study with this title already exists
      const existingStudies = await storage.getStudies({
        query: study.title
      });
      
      const existingStudy = existingStudies.find(s => 
        s.title.toLowerCase() === study.title.toLowerCase() &&
        s.authors.toLowerCase() === study.authors.toLowerCase()
      );
      
      if (existingStudy) {
        console.log(`Study already exists: ${study.title}`);
        continue;
      }
      
      // Create the study
      await storage.createStudy(study);
      successCount++;
      console.log(`Imported study: ${study.title}`);
      
    } catch (error) {
      console.error(`Error importing study: ${error.message}`);
    }
  }
  
  return {
    total: studies.length,
    success: successCount
  };
}

/**
 * Format date to ISO string
 * @param dateString Input date string
 */
function formatDate(dateString: string): string {
  try {
    // Handle different date formats
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    // Try to extract just the year if full date parsing fails
    const yearMatch = dateString.match(/\d{4}/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0]);
      if (year >= 1900 && year <= new Date().getFullYear()) {
        return new Date(`${year}-01-01`).toISOString();
      }
    }
    
    // Default to current date
    return new Date().toISOString();
  } catch (e) {
    console.error(`Error formatting date: ${dateString}`);
    return new Date().toISOString();
  }
}

/**
 * Parse boolean values from strings
 * @param value Boolean string representation
 */
function parseBooleanValue(value: string | boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase();
    return lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1';
  }
  return false;
}