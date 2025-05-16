import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import * as xlsx from 'xlsx';
import axios from 'axios';
import { storage } from './storage';
import { InsertStudy } from '@shared/schema';
import { z } from 'zod';

/**
 * Imports studies from a JSON file
 * @param filePath Path to the JSON file
 */
export async function importStudiesFromJson(filePath: string): Promise<{total: number, success: number}> {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const studies = JSON.parse(fileContent);
    
    if (!Array.isArray(studies)) {
      throw new Error('JSON file must contain an array of studies');
    }
    
    return await importStudies(studies);
  } catch (error: any) {
    console.error('Error importing from JSON:', error);
    throw new Error(`Failed to import studies from JSON: ${error.message}`);
  }
}

/**
 * Imports studies from a CSV file
 * @param filePath Path to the CSV file
 */
export async function importStudiesFromCsv(filePath: string): Promise<{total: number, success: number}> {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    return await importStudies(records);
  } catch (error: any) {
    console.error('Error importing from CSV:', error);
    throw new Error(`Failed to import studies from CSV: ${error.message}`);
  }
}

/**
 * Imports studies from an Excel file (XLSX)
 * @param filePath Path to the Excel file
 */
export async function importStudiesFromExcel(filePath: string): Promise<{total: number, success: number}> {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const records = xlsx.utils.sheet_to_json(worksheet);
    
    return await importStudies(records);
  } catch (error: any) {
    console.error('Error importing from Excel:', error);
    throw new Error(`Failed to import studies from Excel: ${error.message}`);
  }
}

/**
 * Imports studies from Google Sheets
 * @param sheetUrl URL to the Google Sheet (must be publicly accessible or shared)
 */
export async function importStudiesFromGoogleSheets(sheetUrl: string): Promise<{total: number, success: number}> {
  try {
    // Check if it's a valid Google Sheets URL
    if (!sheetUrl.includes('docs.google.com/spreadsheets')) {
      throw new Error('Invalid Google Sheets URL');
    }
    
    // Extract the sheet ID from the URL
    const matches = sheetUrl.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!matches || !matches[1]) {
      throw new Error('Could not extract sheet ID from URL');
    }
    
    const sheetId = matches[1];
    
    // Construct the export URL (CSV format)
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    
    // Fetch the CSV data
    const response = await axios.get(exportUrl, { responseType: 'text' });
    
    // Parse the CSV data
    const records = parse(response.data, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    return await importStudies(records);
  } catch (error: any) {
    console.error('Error importing from Google Sheets:', error);
    throw new Error(`Failed to import studies from Google Sheets: ${error.message}`);
  }
}

// Define a schema for hydrogen research database imports
const hydrogernResearchSchema = z.object({
  Study: z.string().optional(),
  Title: z.string().optional(),
  Abstract: z.string().optional(),
  Results: z.string().optional(),
  Conclusion: z.string().optional(),
  Authors: z.string().optional(),
  Year: z.union([z.string(), z.number()]).optional(),
  PublishedDate: z.string().optional(),
  PublishDate: z.string().optional(),
  PublishYear: z.union([z.string(), z.number()]).optional(),
  Journal: z.string().optional(),
  PeerReviewed: z.union([z.string(), z.boolean()]).optional(),
  DOI: z.string().optional(),
  PDF: z.string().optional(),
  PdfUrl: z.string().optional(),
  CitationUrl: z.string().optional(),
  ImageUrl: z.string().optional(),
  Keywords: z.string().optional(),
  Methods: z.string().optional(),
  Category: z.string().optional(),
  Conditions: z.string().optional(),
  HealthConditions: z.string().optional(),
  BodySystems: z.string().optional(),
  StudyType: z.string().optional(),
  Country: z.string().optional(),
  Region: z.string().optional(),
  SampleSize: z.union([z.string(), z.number()]).optional(),
  Duration: z.string().optional(),
}).passthrough(); // Allow additional fields

/**
 * Import studies into the database
 * @param studies Array of studies to import
 */
async function importStudies(studies: any[]): Promise<{total: number, success: number}> {
  let imported = 0;
  const total = studies.length;
  
  console.log(`Starting import of ${total} studies...`);
  
  for (const item of studies) {
    try {
      // Validate and transform the study data
      const validatedData = hydrogernResearchSchema.parse(item);
      
      // Map fields from the Excel format to our database schema
      const study: InsertStudy = {
        title: validatedData.Title || validatedData.Study || '',
        abstract: validatedData.Abstract || '',
        authors: validatedData.Authors || '',
        journal: validatedData.Journal || '',
        publishDate: formatDate(validatedData.PublishDate || validatedData.PublishedDate || ''),
        publishYear: parseInt(String(validatedData.PublishYear || validatedData.Year || 0)) || null,
        category: validatedData.Category || '',
        methods: validatedData.Methods || '',
        results: validatedData.Results || '',
        conclusion: validatedData.Conclusion || '',
        doi: validatedData.DOI || '',
        pdfUrl: validatedData.PdfUrl || validatedData.PDF || '',
        citationUrl: validatedData.CitationUrl || '',
        peerReviewed: parseBooleanValue(validatedData.PeerReviewed),
        imageUrl: validatedData.ImageUrl || '',
        // Handle additional fields for advanced filtering
        keywords: validatedData.Keywords || '',
        healthConditions: validatedData.HealthConditions || validatedData.Conditions || '',
        bodySystems: validatedData.BodySystems || '',
        studyType: validatedData.StudyType || '',
        country: validatedData.Country || '',
        region: validatedData.Region || '',
        sampleSize: parseInt(String(validatedData.SampleSize || 0)) || null,
        duration: validatedData.Duration || ''
      };
      
      // Check required fields
      if (!study.title) {
        console.warn('Skipping study with no title');
        continue;
      }
      
      // Create the study in the database
      await storage.createStudy(study);
      imported++;
      
    } catch (error) {
      console.error('Failed to import study:', error);
    }
  }
  
  console.log(`Import completed. Imported ${imported} out of ${total} studies.`);
  
  return {
    total,
    success: imported
  };
}

/**
 * Format date to ISO string
 * @param dateString Input date string
 */
function formatDate(dateString: string): string {
  if (!dateString) return new Date().toISOString();
  
  try {
    // Try to parse the date directly
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    // Check for common date formats
    // Format: YYYY-MM-DD
    const isoFormat = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
    // Format: MM/DD/YYYY
    const usFormat = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    // Format: Month DD, YYYY (e.g., January 1, 2022)
    const textFormat = /^([a-zA-Z]+)\s+(\d{1,2}),\s+(\d{4})$/;
    
    let match;
    
    if ((match = isoFormat.exec(dateString))) {
      const [_, year, month, day] = match;
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day)
      ).toISOString();
    }
    
    if ((match = usFormat.exec(dateString))) {
      const [_, month, day, year] = match;
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day)
      ).toISOString();
    }
    
    if ((match = textFormat.exec(dateString))) {
      const [_, monthName, day, year] = match;
      const months = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
      };
      
      const monthIndex = months[monthName.toLowerCase() as keyof typeof months];
      
      if (monthIndex !== undefined) {
        return new Date(
          parseInt(year),
          monthIndex,
          parseInt(day)
        ).toISOString();
      }
    }
    
    // Fall back to current date
    return new Date().toISOString();
    
  } catch (error) {
    console.warn(`Error parsing date "${dateString}":`, error);
    return new Date().toISOString();
  }
}

/**
 * Parse boolean values from strings
 * @param value Boolean string representation
 */
function parseBooleanValue(value: string | boolean | undefined): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  
  if (typeof value === 'boolean') {
    return value;
  }
  
  const trueValues = ['true', 'yes', 'y', '1', 'on'];
  
  return trueValues.includes(value.toString().toLowerCase());
}