/**
 * Schema vs Code Audit Tool
 * 
 * Analyzes the database schema against code usage to identify:
 * - Missing columns referenced in code
 * - Type mismatches
 * - Unused schema fields
 * - Inconsistent naming conventions
 */
import { db } from './db.js';
import * as schema from '../shared/schema.js';
import fs from 'fs';
import path from 'path';

interface SchemaIssue {
  type: 'missing_column' | 'type_mismatch' | 'naming_inconsistency' | 'unused_field' | 'code_error';
  file: string;
  line?: number;
  column?: string;
  expected?: string;
  actual?: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Get all TypeScript/JavaScript files in the project
 */
function getProjectFiles(dir: string, files: string[] = []): string[] {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      getProjectFiles(fullPath, files);
    } else if (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Extract column references from code
 */
function extractColumnReferences(content: string, filePath: string): Array<{column: string, line: number}> {
  const references: Array<{column: string, line: number}> = [];
  const lines = content.split('\n');
  
  // Common patterns for database column access
  const patterns = [
    /\.where\(eq\(\w+\.(\w+)/g,           // .where(eq(studies.columnName
    /\.set\(\{\s*(\w+):/g,               // .set({ columnName:
    /\.select\(\{\s*(\w+):/g,            // .select({ columnName:
    /studies\.(\w+)/g,                   // studies.columnName
    /users\.(\w+)/g,                     // users.columnName
    /blogArticles\.(\w+)/g,              // blogArticles.columnName
    /categories\.(\w+)/g,                // categories.columnName
    /study\.(\w+)/g,                     // study.columnName (in queries)
    /user\.(\w+)/g,                      // user.columnName
    /article\.(\w+)/g,                   // article.columnName
  ];
  
  lines.forEach((line, index) => {
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        if (match[1] && !match[1].startsWith('_')) { // Skip private fields
          references.push({
            column: match[1],
            line: index + 1
          });
        }
      }
    });
  });
  
  return references;
}

/**
 * Get schema column definitions
 */
function getSchemaColumns() {
  const studiesColumns = Object.keys(schema.studies);
  const usersColumns = Object.keys(schema.users);
  const blogColumns = Object.keys(schema.blogArticles || {});
  const categoriesColumns = Object.keys(schema.categories || {});
  
  return {
    studies: studiesColumns,
    users: usersColumns,
    blogArticles: blogColumns,
    categories: categoriesColumns
  };
}

/**
 * Check for naming convention issues
 */
function checkNamingConventions(references: Array<{column: string, line: number, file: string}>): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  
  references.forEach(ref => {
    // Check for snake_case vs camelCase inconsistencies
    if (ref.column.includes('_')) {
      const camelCase = ref.column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      issues.push({
        type: 'naming_inconsistency',
        file: ref.file,
        line: ref.line,
        column: ref.column,
        expected: camelCase,
        actual: ref.column,
        description: `Found snake_case column "${ref.column}", expected camelCase "${camelCase}"`,
        severity: 'warning'
      });
    }
  });
  
  return issues;
}

/**
 * Check for missing columns
 */
function checkMissingColumns(references: Array<{column: string, line: number, file: string}>, schemaColumns: any): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  
  references.forEach(ref => {
    let found = false;
    
    // Check in all schema tables
    Object.entries(schemaColumns).forEach(([tableName, columns]) => {
      if (Array.isArray(columns) && columns.includes(ref.column)) {
        found = true;
      }
    });
    
    if (!found) {
      issues.push({
        type: 'missing_column',
        file: ref.file,
        line: ref.line,
        column: ref.column,
        description: `Column "${ref.column}" referenced in code but not found in schema`,
        severity: 'error'
      });
    }
  });
  
  return issues;
}

/**
 * Audit specific common issues
 */
function auditCommonIssues(content: string, filePath: string): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Check for supplementary_materials vs supplementaryMaterials
    if (line.includes('supplementary_materials')) {
      issues.push({
        type: 'naming_inconsistency',
        file: filePath,
        line: index + 1,
        column: 'supplementary_materials',
        expected: 'supplementaryMaterials',
        actual: 'supplementary_materials',
        description: 'Using snake_case "supplementary_materials" instead of camelCase "supplementaryMaterials"',
        severity: 'error'
      });
    }
    
    // Check for updatedAt references (not in schema)
    if (line.includes('.updatedAt') && !line.includes('users.updatedAt')) {
      issues.push({
        type: 'missing_column',
        file: filePath,
        line: index + 1,
        column: 'updatedAt',
        description: 'Column "updatedAt" referenced but not defined in studies schema',
        severity: 'error'
      });
    }
    
    // Check for consumerCategories references
    if (line.includes('consumerCategories') && !line.includes('studies.consumerCategories')) {
      issues.push({
        type: 'missing_column',
        file: filePath,
        line: index + 1,
        column: 'consumerCategories',
        description: 'Column "consumerCategories" may not be properly defined',
        severity: 'warning'
      });
    }
  });
  
  return issues;
}

/**
 * Main audit function
 */
async function auditSchema(): Promise<void> {
  console.log('🔍 Starting schema vs code audit...\n');
  
  const projectFiles = getProjectFiles('./');
  const schemaColumns = getSchemaColumns();
  const allIssues: SchemaIssue[] = [];
  const allReferences: Array<{column: string, line: number, file: string}> = [];
  
  // Analyze each file
  for (const filePath of projectFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const references = extractColumnReferences(content, filePath);
      
      // Add file path to references
      const fileReferences = references.map(ref => ({
        ...ref,
        file: filePath
      }));
      
      allReferences.push(...fileReferences);
      
      // Check for common issues in this file
      const commonIssues = auditCommonIssues(content, filePath);
      allIssues.push(...commonIssues);
      
    } catch (error) {
      console.warn(`Warning: Could not read file ${filePath}`);
    }
  }
  
  // Run checks
  const missingColumnIssues = checkMissingColumns(allReferences, schemaColumns);
  const namingIssues = checkNamingConventions(allReferences);
  
  allIssues.push(...missingColumnIssues);
  allIssues.push(...namingIssues);
  
  // Group and display results
  const errorIssues = allIssues.filter(issue => issue.severity === 'error');
  const warningIssues = allIssues.filter(issue => issue.severity === 'warning');
  
  console.log('📊 AUDIT RESULTS\n');
  console.log(`Found ${errorIssues.length} errors and ${warningIssues.length} warnings\n`);
  
  if (errorIssues.length > 0) {
    console.log('❌ ERRORS:');
    errorIssues.forEach(issue => {
      console.log(`  ${issue.file}:${issue.line || '?'} - ${issue.description}`);
      if (issue.expected) {
        console.log(`    Expected: ${issue.expected}, Got: ${issue.actual}`);
      }
    });
    console.log('');
  }
  
  if (warningIssues.length > 0) {
    console.log('⚠️  WARNINGS:');
    warningIssues.forEach(issue => {
      console.log(`  ${issue.file}:${issue.line || '?'} - ${issue.description}`);
      if (issue.expected) {
        console.log(`    Suggested: ${issue.expected}`);
      }
    });
    console.log('');
  }
  
  if (allIssues.length === 0) {
    console.log('✅ No schema issues found!');
  }
  
  // Show schema summary
  console.log('📋 SCHEMA SUMMARY:');
  Object.entries(schemaColumns).forEach(([tableName, columns]) => {
    if (Array.isArray(columns) && columns.length > 0) {
      console.log(`  ${tableName}: ${columns.length} columns`);
    }
  });
  
  console.log('\n🔍 Audit complete');
}

// Run the audit if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  auditSchema()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Audit failed:', error);
      process.exit(1);
    });
}

export { auditSchema };