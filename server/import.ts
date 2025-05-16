import fs from 'fs';
import path from 'path';
import { parse as parseCsv } from 'csv-parse/sync';
import { storage } from './storage';
import { InsertStudy } from '@shared/schema';

/**
 * Imports studies from a JSON file
 * @param filePath Path to the JSON file
 */
export async function importStudiesFromJson(filePath: string): Promise<{total: number, success: number}> {
  try {
    console.log(`Importing studies from JSON file: ${filePath}`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const studies = JSON.parse(fileContent);
    
    if (!Array.isArray(studies)) {
      throw new Error('JSON file must contain an array of studies');
    }
    
    return await importStudies(studies);
  } catch (error) {
    console.error('Error importing studies from JSON:', error);
    throw error;
  }
}

/**
 * Imports studies from a CSV file
 * @param filePath Path to the CSV file
 */
export async function importStudiesFromCsv(filePath: string): Promise<{total: number, success: number}> {
  try {
    console.log(`Importing studies from CSV file: ${filePath}`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Parse CSV
    const records = parseCsv(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    // Map CSV records to study objects
    const studies = records.map((record: any) => {
      return {
        title: record.title || '',
        abstract: record.abstract || '',
        authors: record.authors || '',
        journal: record.journal || '',
        publishDate: formatDate(record.publishDate || record.publish_date || record.date || ''),
        category: record.category || 'General',
        methods: record.methods || '',
        results: record.results || '',
        conclusion: record.conclusion || '',
        doi: record.doi || '',
        pdfUrl: record.pdfUrl || record.pdf_url || '',
        citationUrl: record.citationUrl || record.citation_url || '',
        peerReviewed: parseBooleanValue(record.peerReviewed || record.peer_reviewed || 'false')
      };
    });
    
    return await importStudies(studies);
  } catch (error) {
    console.error('Error importing studies from CSV:', error);
    throw error;
  }
}

/**
 * Import studies into the database
 * @param studies Array of studies to import
 */
async function importStudies(studies: any[]): Promise<{total: number, success: number}> {
  let successCount = 0;
  
  console.log(`Found ${studies.length} studies to import`);
  
  for (let i = 0; i < studies.length; i++) {
    try {
      const studyData = studies[i];
      
      // Validate required fields
      if (!studyData.title) {
        console.log(`Skipping study at index ${i} because title is missing`);
        continue;
      }
      
      // Ensure publishDate is a valid date string
      if (!studyData.publishDate) {
        studyData.publishDate = new Date().toISOString();
      }
      
      // Create the study in the database
      const study: InsertStudy = {
        title: studyData.title,
        abstract: studyData.abstract || '',
        authors: studyData.authors || '',
        journal: studyData.journal || '',
        publishDate: studyData.publishDate,
        category: studyData.category || 'General',
        methods: studyData.methods || '',
        results: studyData.results || '',
        conclusion: studyData.conclusion || '',
        doi: studyData.doi || '',
        pdfUrl: studyData.pdfUrl || '',
        citationUrl: studyData.citationUrl || '',
        peerReviewed: Boolean(studyData.peerReviewed)
      };
      
      await storage.createStudy(study);
      successCount++;
      
      // Log progress periodically
      if (i % 10 === 0 || i === studies.length - 1) {
        console.log(`Imported ${successCount}/${i+1} studies so far...`);
      }
    } catch (error) {
      console.error(`Error importing study at index ${i}:`, error.message);
    }
  }
  
  console.log(`Import complete. Successfully imported ${successCount}/${studies.length} studies.`);
  return { total: studies.length, success: successCount };
}

/**
 * Format date to ISO string
 * @param dateString Input date string
 */
function formatDate(dateString: string): string {
  if (!dateString) return new Date().toISOString();
  
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    // Try to parse year only
    const yearMatch = dateString.match(/\d{4}/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0]);
      if (year >= 1900 && year <= new Date().getFullYear()) {
        return new Date(`${year}-01-01`).toISOString();
      }
    }
  } catch (e) {
    console.log(`Error parsing date: ${dateString}`);
  }
  
  return new Date().toISOString();
}

/**
 * Parse boolean values from strings
 * @param value Boolean string representation
 */
function parseBooleanValue(value: string): boolean {
  if (typeof value === 'boolean') return value;
  
  const strValue = String(value).toLowerCase().trim();
  return ['true', 'yes', '1', 'y'].includes(strValue);
}