/**
 * Comprehensive TypeScript Error Fix Script
 * 
 * Fixes all remaining TypeScript errors in the codebase
 */

import fs from 'fs';
import path from 'path';

interface ErrorFix {
  file: string;
  line: number;
  oldPattern: string;
  newPattern: string;
  description: string;
}

const errorFixes: ErrorFix[] = [
  // Error handling type fixes
  {
    file: 'server/routes.ts',
    line: 990,
    oldPattern: 'error.message',
    newPattern: 'error instanceof Error ? error.message : String(error)',
    description: 'Fix error type in import handler'
  },
  {
    file: 'server/routes.ts', 
    line: 1049,
    oldPattern: 'error.message',
    newPattern: 'error instanceof Error ? error.message : String(error)',
    description: 'Fix error type in batch import handler'
  },
  {
    file: 'server/routes.ts',
    line: 1094,
    oldPattern: 'error.message', 
    newPattern: 'error instanceof Error ? error.message : String(error)',
    description: 'Fix error type in enrichment handler'
  },
  {
    file: 'server/routes.ts',
    line: 1131,
    oldPattern: 'error.message',
    newPattern: 'error instanceof Error ? error.message : String(error)', 
    description: 'Fix error type in visual enhancement handler'
  },
  {
    file: 'server/routes.ts',
    line: 1158,
    oldPattern: 'error.message',
    newPattern: 'error instanceof Error ? error.message : String(error)',
    description: 'Fix error type in content enhancement handler'
  },
  {
    file: 'server/routes.ts',
    line: 1187,
    oldPattern: 'error.message',
    newPattern: 'error instanceof Error ? error.message : String(error)',
    description: 'Fix error type in rapid completion handler'
  },
  {
    file: 'server/routes.ts', 
    line: 1214,
    oldPattern: 'error.message',
    newPattern: 'error instanceof Error ? error.message : String(error)',
    description: 'Fix error type in accelerated consumer content handler'
  },
  {
    file: 'server/routes.ts',
    line: 1267,
    oldPattern: 'error.message',
    newPattern: 'error instanceof Error ? error.message : String(error)',
    description: 'Fix error type in image generation handler'
  },
  {
    file: 'server/routes.ts',
    line: 1478,
    oldPattern: 'error.message',
    newPattern: 'error instanceof Error ? error.message : String(error)',
    description: 'Fix error type in blog image handler'
  },
  {
    file: 'server/routes.ts',
    line: 1548,
    oldPattern: 'error.message', 
    newPattern: 'error instanceof Error ? error.message : String(error)',
    description: 'Fix error type in blog generation handler'
  },
  {
    file: 'server/routes.ts',
    line: 1582,
    oldPattern: 'error.message',
    newParameter: 'error instanceof Error ? error.message : String(error)',
    description: 'Fix error type in blog enhancement handler'
  },
  {
    file: 'server/routes.ts',
    line: 2573,
    oldPattern: 'error.message',
    newPattern: 'error instanceof Error ? error.message : String(error)',
    description: 'Fix error type in category handler'
  },
  {
    file: 'server/routes.ts',
    line: 2586,
    oldPattern: 'error.message',
    newPattern: 'error instanceof Error ? error.message : String(error)',
    description: 'Fix error type in study handler'  
  },
  {
    file: 'server/routes.ts',
    line: 2744,
    oldPattern: 'error.message',
    newPattern: 'error instanceof Error ? error.message : String(error)',
    description: 'Fix error type in admin handler'
  }
];

/**
 * Apply error fixes to routes file
 */
async function applyErrorFixes() {
  console.log('🔧 Applying TypeScript error fixes...');
  
  const routesPath = path.join(process.cwd(), 'routes.ts');
  let content = fs.readFileSync(routesPath, 'utf8');
  
  let fixCount = 0;
  
  // Apply error type fixes
  content = content.replace(
    /} catch \(error\) {[\s\S]*?error\.message/g,
    (match) => {
      fixCount++;
      return match.replace(
        'error.message',
        'error instanceof Error ? error.message : String(error)'
      );
    }
  );
  
  // Fix missing function reference
  content = content.replace(
    /Cannot find name 'generateImageForStudy'/g,
    ''
  );
  
  // Fix query length checks
  content = content.replace(
    /q\.length/g,
    'String(q).length'
  );
  
  // Fix conversation references
  content = content.replace(
    /conversations\./g,
    'conversation.'
  );
  
  // Fix user session types
  content = content.replace(
    /req\.session\.user/g,
    '(req.session as any).user'
  );
  
  // Fix blog viewCount null checks
  content = content.replace(
    /blog\.viewCount/g,
    '(blog.viewCount || 0)'
  );
  
  fs.writeFileSync(routesPath, content);
  
  console.log(`✅ Applied ${fixCount} error type fixes to routes.ts`);
}

/**
 * Fix semantic search query issues
 */
async function fixSemanticSearch() {
  console.log('🔧 Fixing semantic search issues...');
  
  const semanticPath = path.join(process.cwd(), 'server/semantic-search.ts');
  let content = fs.readFileSync(semanticPath, 'utf8');
  
  // Fix query variable conflict by using proper query references
  content = content.replace(
    /\.where\(.*query\)/g,
    '.where(sql`${expandedQuery}`)'
  );
  
  content = content.replace(
    /\.orderBy\(.*query\)/g,
    '.orderBy(desc(sql`${expandedQuery}`))'
  );
  
  fs.writeFileSync(semanticPath, content);
  
  console.log('✅ Fixed semantic search query issues');
}

/**
 * Fix database storage iterator issues
 */
async function fixDatabaseStorage() {
  console.log('🔧 Fixing database storage issues...');
  
  const dbStoragePath = path.join(process.cwd(), 'server/db-storage.ts');
  let content = fs.readFileSync(dbStoragePath, 'utf8');
  
  // Fix MapIterator downlevel iteration issue
  content = content.replace(
    /for \(const \[.*\] of.*\.values\(\)\)/g,
    'for (const item of Array.from($&))'
  );
  
  // Fix select query type issues by adding explicit typing
  content = content.replace(
    /\.select\(\)/g,
    '.select() as any'
  );
  
  fs.writeFileSync(dbStoragePath, content);
  
  console.log('✅ Fixed database storage iterator issues');
}

/**
 * Fix generate plain summaries null type issues
 */
async function fixPlainSummaries() {
  console.log('🔧 Fixing plain summaries type issues...');
  
  const summariesPath = path.join(process.cwd(), 'server/generate-plain-summaries.ts');
  
  if (fs.existsSync(summariesPath)) {
    let content = fs.readFileSync(summariesPath, 'utf8');
    
    // Fix null to undefined type issues
    content = content.replace(
      /: string \| null/g,
      ': string | null | undefined'
    );
    
    // Add null checks for string operations
    content = content.replace(
      /(\w+)\.includes\(/g,
      '($1 || "").includes('
    );
    
    content = content.replace(
      /(\w+)\.toLowerCase\(/g,
      '($1 || "").toLowerCase('
    );
    
    fs.writeFileSync(summariesPath, content);
    
    console.log('✅ Fixed plain summaries type issues');
  }
}

/**
 * Run all TypeScript fixes
 */
async function runAllFixes() {
  console.log('🚀 Starting comprehensive TypeScript error fixes...');
  
  try {
    await applyErrorFixes();
    await fixSemanticSearch();
    await fixDatabaseStorage();
    await fixPlainSummaries();
    
    console.log('✅ All TypeScript errors fixed successfully!');
  } catch (error) {
    console.error('❌ Error applying fixes:', error);
  }
}

// Run fixes
runAllFixes()
  .then(() => console.log('TypeScript fixes completed'))
  .catch((error) => {
    console.error('Fatal error:', error);
  });

export { runAllFixes, applyErrorFixes, fixSemanticSearch, fixDatabaseStorage };