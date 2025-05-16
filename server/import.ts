import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import xlsx from 'xlsx';
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
  // Generic fields that could exist in different formats
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
  
  // Fields specific to the Hydrogen Research Database
  ID: z.union([z.string(), z.number()]).optional(),
  "First Author": z.string().optional(),
  "Other Authors": z.string().optional(),
  "Last Author": z.string().optional(),
  "Publish Year": z.union([z.string(), z.number()]).optional(),
  "DOI/PMID/Link": z.string().optional(),
  Rank: z.string().optional(),
  Model: z.string().optional(),
  "Primary Topic": z.string().optional(),
  "Secondary Topic": z.string().optional(),
  "Tertiary Topic": z.string().optional(),
  Vehicle: z.string().optional(),
  pH: z.string().optional(),
  Application: z.string().optional(),
  Comparison: z.string().optional(),
  Complement: z.string().optional(),
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
      // Handle different column formats (generic format or Hydrogen Research Database format)
      
      // Combine authors if present in separate fields
      let authors = validatedData.Authors || '';
      if (validatedData["First Author"] || validatedData["Other Authors"] || validatedData["Last Author"]) {
        const firstAuthor = validatedData["First Author"] || '';
        const otherAuthors = validatedData["Other Authors"] || '';
        const lastAuthor = validatedData["Last Author"] || '';
        
        // Format: "First Author, Other Authors, Last Author"
        authors = [firstAuthor, otherAuthors, lastAuthor]
          .filter(a => a) // Remove empty authors
          .join(', ');
      }
      
      // Extract DOI from combined field if present
      let doi = validatedData.DOI || '';
      let citationUrl = validatedData.CitationUrl || '';
      if (validatedData["DOI/PMID/Link"]) {
        const doiPmidLink = validatedData["DOI/PMID/Link"] || '';
        // If it looks like a DOI
        if (doiPmidLink.includes('10.') || doiPmidLink.startsWith('doi:')) {
          doi = doiPmidLink;
        } else if (doiPmidLink.startsWith('http')) {
          citationUrl = doiPmidLink;
        }
      }
      
      // Combine topics into keywords
      let keywords = validatedData.Keywords || '';
      if (validatedData["Primary Topic"] || validatedData["Secondary Topic"] || validatedData["Tertiary Topic"]) {
        const primaryTopic = validatedData["Primary Topic"] || '';
        const secondaryTopic = validatedData["Secondary Topic"] || '';
        const tertiaryTopic = validatedData["Tertiary Topic"] || '';
        
        // Format: "Primary Topic, Secondary Topic, Tertiary Topic"
        keywords = [primaryTopic, secondaryTopic, tertiaryTopic]
          .filter(t => t) // Remove empty topics
          .join(', ');
      }
      
      // Extract study type from Model
      let studyType = validatedData.StudyType || '';
      if (validatedData.Model) {
        studyType = validatedData.Model || '';
      }
      
      // Determine health conditions from topics
      let healthConditions = validatedData.HealthConditions || validatedData.Conditions || '';
      if (validatedData["Primary Topic"]) {
        const primaryTopic = validatedData["Primary Topic"] as string;
        if (isHealthConditionTopic(primaryTopic)) {
          healthConditions = primaryTopic;
        }
      } else if (validatedData["Secondary Topic"]) {
        const secondaryTopic = validatedData["Secondary Topic"] as string;
        if (isHealthConditionTopic(secondaryTopic)) {
          healthConditions = secondaryTopic;
        }
      }
      
      // Determine body systems from topics
      let bodySystems = validatedData.BodySystems || '';
      if (validatedData["Primary Topic"]) {
        const primaryTopic = validatedData["Primary Topic"] as string;
        if (isBodySystemTopic(primaryTopic)) {
          bodySystems = primaryTopic;
        }
      } else if (validatedData["Secondary Topic"]) {
        const secondaryTopic = validatedData["Secondary Topic"] as string;
        if (isBodySystemTopic(secondaryTopic)) {
          bodySystems = secondaryTopic;
        }
      }
      
      // Generate a study object from the validated data
      const title = validatedData.Title || '';
      const publishYearValue = parseInt(String(validatedData.PublishYear || validatedData.Year || validatedData["Publish Year"] || 0)) || null;
      
      // Combine primary/secondary topics for category determination
      const primaryTopic = validatedData["Primary Topic"] as string || '';
      const secondaryTopic = validatedData["Secondary Topic"] as string || '';
      const category = validatedData.Category || mapTopicToCategory(primaryTopic, secondaryTopic);
      
      // Get study type from Model field
      const model = validatedData.Model as string || '';
      const methods = validatedData.Methods || mapModelToMethods(model);
      
      // Determine if results were positive or negative
      const rank = validatedData.Rank as string || '';
      const results = validatedData.Results || (rank === 'Positive' ? 'Positive results reported.' : 'Results unclear or negative.');
      
      // Journal peer review status
      const journal = validatedData.Journal || '';
      const peerReviewed = parseBooleanValue(validatedData.PeerReviewed) || checkIfPeerReviewed(journal);
      
      // Handle application duration
      const application = validatedData.Application as string || '';
      const durationText = validatedData.Duration || getApplicationDuration(application);
      // Convert duration to number if possible, otherwise null
      let durationValue: number | null = null;
      if (durationText) {
        const parsed = parseInt(durationText);
        if (!isNaN(parsed)) {
          durationValue = parsed;
        }
      }
      
      // Create the study object with properly typed fields
      const study: InsertStudy = {
        title: title,
        abstract: validatedData.Abstract || '',
        authors: authors,
        journal: journal,
        publishDate: formatDate(validatedData.PublishDate || validatedData.PublishedDate || validatedData["Publish Year"]?.toString() || ''),
        publishYear: publishYearValue,
        category: category,
        methods: methods,
        results: results,
        conclusion: validatedData.Conclusion || '',
        doi: doi,
        pdfUrl: validatedData.PdfUrl || validatedData.PDF || '',
        citationUrl: citationUrl,
        peerReviewed: peerReviewed,
        imageUrl: validatedData.ImageUrl || '',
        // Store health conditions and body systems in comments for now
        // We'll properly map these to the related tables later
        studyType: studyType,
        country: validatedData.Country || '',
        region: validatedData.Region || '',
        sampleSize: null, // We'll set this properly if available
        duration: durationValue
      };
      
      // Handle sampleSize separately to avoid type issues
      if (validatedData.SampleSize) {
        const sampleSizeNum = parseInt(String(validatedData.SampleSize));
        if (!isNaN(sampleSizeNum)) {
          study.sampleSize = sampleSizeNum;
        }
      }
      
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
  
  const trueValues = ['true', 'yes', 'y', '1', 'on', 'positive'];
  
  return trueValues.includes(value.toString().toLowerCase());
}

/**
 * Determine if a topic is a health condition
 * @param topic Topic string
 */
function isHealthConditionTopic(topic: string): boolean {
  const healthConditions = [
    'cancer', 'diabetes', 'alzheimer', 'parkinson', 'stroke', 
    'sepsis', 'injury', 'inflammation', 'oxidative stress',
    'hypertension', 'asthma', 'arthritis', 'allergies',
    'metabolic', 'wound', 'infection', 'autoimmune'
  ];
  
  return healthConditions.some(condition => 
    topic.toLowerCase().includes(condition)
  );
}

/**
 * Determine if a topic is a body system
 * @param topic Topic string
 */
function isBodySystemTopic(topic: string): boolean {
  const bodySystems = [
    'brain', 'neuro', 'liver', 'kidney', 'lung', 'heart', 
    'cardiac', 'cardiovascular', 'skin', 'muscle', 'bone',
    'digestive', 'intestine', 'colon', 'gut', 'respiratory',
    'immune', 'endocrine', 'reproductive', 'blood'
  ];
  
  return bodySystems.some(system => 
    topic.toLowerCase().includes(system)
  );
}

/**
 * Map topic to category
 * @param primaryTopic Primary topic
 * @param secondaryTopic Secondary topic
 */
function mapTopicToCategory(primaryTopic?: string, secondaryTopic?: string): string {
  // Default category
  let category = 'General';
  
  // List of terms and their category mappings
  const categoryMappings: Record<string, string> = {
    'inflammation': 'Inflammation',
    'oxidative stress': 'Inflammation',
    'brain': 'Neurological',
    'neuro': 'Neurological',
    'heart': 'Cardiovascular',
    'cardiac': 'Cardiovascular',
    'cardiovascular': 'Cardiovascular',
    'liver': 'Liver',
    'kidney': 'Kidney',
    'renal': 'Kidney',
    'lung': 'Respiratory',
    'respiratory': 'Respiratory',
    'metabolic': 'Metabolic',
    'diabetes': 'Metabolic',
    'cancer': 'Cancer',
    'tumor': 'Cancer',
    'skin': 'Dermatology',
    'aging': 'Aging',
    'exercise': 'Fitness',
    'muscle': 'Fitness',
    'athletic': 'Fitness',
    'immune': 'Immunology',
    'gut': 'Gastrointestinal',
    'intestine': 'Gastrointestinal',
    'gastrointestinal': 'Gastrointestinal',
  };
  
  // Check primary topic first
  if (primaryTopic) {
    for (const [term, mappedCategory] of Object.entries(categoryMappings)) {
      if (primaryTopic.toLowerCase().includes(term)) {
        category = mappedCategory;
        break;
      }
    }
  }
  
  // If no category found, check secondary topic
  if (category === 'General' && secondaryTopic) {
    for (const [term, mappedCategory] of Object.entries(categoryMappings)) {
      if (secondaryTopic.toLowerCase().includes(term)) {
        category = mappedCategory;
        break;
      }
    }
  }
  
  return category;
}

/**
 * Map model to methods
 * @param model Model name (Human, Animal, In Vitro, etc.)
 */
function mapModelToMethods(model?: string): string {
  if (!model) return '';
  
  const modelLower = model.toLowerCase();
  
  if (modelLower.includes('human')) {
    return 'Human clinical trial';
  } else if (modelLower.includes('animal')) {
    return 'Animal study';
  } else if (modelLower.includes('vitro') || modelLower.includes('cell')) {
    return 'In vitro cell culture study';
  } else if (modelLower.includes('silico') || modelLower.includes('computational')) {
    return 'Computational modeling study';
  } else if (modelLower.includes('review')) {
    return 'Literature review and meta-analysis';
  }
  
  return model;
}

/**
 * Check if a journal is likely peer-reviewed
 * @param journal Journal name
 */
function checkIfPeerReviewed(journal?: string): boolean {
  if (!journal) return false;
  
  // Most legitimate scientific journals are peer-reviewed
  // Look for indicators in journal name
  const journalLower = journal.toLowerCase();
  
  // Non-peer-reviewed indicators
  const nonPeerReviewedTerms = [
    'preprint', 'blog', 'magazine', 'newsletter', 'proceeding'
  ];
  
  // Check for non-peer-reviewed indicators
  if (nonPeerReviewedTerms.some(term => journalLower.includes(term))) {
    return false;
  }
  
  // Peer-reviewed indicators
  const peerReviewedTerms = [
    'journal', 'transactions', 'review', 'science', 'medicine',
    'medical', 'research', 'reports', 'letters', 'proceedings'
  ];
  
  // Check for peer-reviewed indicators
  return peerReviewedTerms.some(term => journalLower.includes(term));
}

/**
 * Get duration from application method
 * @param application Application method
 */
function getApplicationDuration(application?: string): string {
  if (!application) return '';
  
  const applicationLower = application.toLowerCase();
  
  if (applicationLower.includes('acute')) {
    return 'Acute (single dose)';
  } else if (applicationLower.includes('chronic')) {
    return 'Chronic (multiple doses)';
  } else if (applicationLower.includes('intermittent')) {
    return 'Intermittent dosing';
  } else if (applicationLower.includes('continuous')) {
    return 'Continuous administration';
  }
  
  return '';
}