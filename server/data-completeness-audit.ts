/**
 * Data Completeness Audit
 * 
 * Comprehensive analysis of study data completeness across all fields
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

interface FieldCompleteness {
  fieldName: string;
  totalStudies: number;
  completedStudies: number;
  completionPercentage: number;
  avgLength?: number;
  sampleValues: string[];
}

interface DataQualityMetrics {
  totalStudies: number;
  overallCompleteness: number;
  coreFields: FieldCompleteness[];
  enhancedFields: FieldCompleteness[];
  researchLinks: FieldCompleteness[];
  contentFields: FieldCompleteness[];
  metadata: FieldCompleteness[];
}

async function auditDataCompleteness(): Promise<DataQualityMetrics> {
  console.log('Starting comprehensive data completeness audit...');
  
  // Get total study count
  const totalResult = await db.execute(sql`SELECT COUNT(*) as total FROM studies`);
  const totalStudies = Number(totalResult.rows[0].total);

  console.log(`Auditing ${totalStudies} studies for data completeness...`);

  // Core academic fields
  const coreFields = await auditFieldGroup([
    { name: 'title', required: true },
    { name: 'abstract', required: true },
    { name: 'authors', required: true },
    { name: 'journal', required: true },
    { name: 'publish_date', required: true },
    { name: 'category', required: true },
    { name: 'doi', required: true }
  ], totalStudies);

  // Enhanced content fields
  const enhancedFields = await auditFieldGroup([
    { name: 'methods', required: false },
    { name: 'results', required: false },
    { name: 'conclusion', required: false },
    { name: 'objective', required: false },
    { name: 'methods_short', required: false },
    { name: 'results_short', required: false },
    { name: 'conclusion_short', required: false },
    { name: 'summary_markdown', required: false }
  ], totalStudies);

  // Research links and verification
  const researchLinks = await auditFieldGroup([
    { name: 'citation_url', required: false },
    { name: 'source_url', required: false },
    { name: 'pdf_url', required: false }
  ], totalStudies);

  // Content and media fields
  const contentFields = await auditFieldGroup([
    { name: 'image_url', required: false },
    { name: 'image_alt', required: false },
    { name: 'video_url', required: false },
    { name: 'audio_url', required: false }
  ], totalStudies);

  // Metadata and classification
  const metadata = await auditFieldGroup([
    { name: 'publish_year', required: false },
    { name: 'peer_reviewed', required: false },
    { name: 'study_type', required: false },
    { name: 'sample_size', required: false },
    { name: 'duration', required: false },
    { name: 'health_conditions', required: false },
    { name: 'body_systems', required: false },
    { name: 'keywords', required: false },
    { name: 'consumer_categories', required: false }
  ], totalStudies);

  // Calculate overall completeness
  const allFields = [...coreFields, ...enhancedFields, ...researchLinks, ...contentFields, ...metadata];
  const overallCompleteness = allFields.reduce((sum, field) => sum + field.completionPercentage, 0) / allFields.length;

  return {
    totalStudies,
    overallCompleteness: Math.round(overallCompleteness * 100) / 100,
    coreFields,
    enhancedFields,
    researchLinks,
    contentFields,
    metadata
  };
}

async function auditFieldGroup(fields: Array<{ name: string; required: boolean }>, totalStudies: number): Promise<FieldCompleteness[]> {
  const results: FieldCompleteness[] = [];

  for (const field of fields) {
    try {
      // Check for array fields (keywords)
      const isArrayField = field.name === 'keywords';
      
      let completedQuery;
      let lengthQuery;
      let sampleQuery;

      if (isArrayField) {
        completedQuery = sql`
          SELECT COUNT(*) as completed 
          FROM studies 
          WHERE ${sql.identifier(field.name)} IS NOT NULL 
          AND array_length(${sql.identifier(field.name)}, 1) > 0
        `;
        
        lengthQuery = sql`
          SELECT AVG(array_length(${sql.identifier(field.name)}, 1)) as avg_length 
          FROM studies 
          WHERE ${sql.identifier(field.name)} IS NOT NULL
        `;
        
        sampleQuery = sql`
          SELECT ${sql.identifier(field.name)} as value 
          FROM studies 
          WHERE ${sql.identifier(field.name)} IS NOT NULL 
          AND array_length(${sql.identifier(field.name)}, 1) > 0
          ORDER BY RANDOM() 
          LIMIT 3
        `;
      } else {
        completedQuery = sql`
          SELECT COUNT(*) as completed 
          FROM studies 
          WHERE ${sql.identifier(field.name)} IS NOT NULL 
          AND TRIM(COALESCE(${sql.identifier(field.name)}::text, '')) != ''
        `;
        
        lengthQuery = sql`
          SELECT AVG(LENGTH(${sql.identifier(field.name)}::text)) as avg_length 
          FROM studies 
          WHERE ${sql.identifier(field.name)} IS NOT NULL 
          AND TRIM(COALESCE(${sql.identifier(field.name)}::text, '')) != ''
        `;
        
        sampleQuery = sql`
          SELECT ${sql.identifier(field.name)} as value 
          FROM studies 
          WHERE ${sql.identifier(field.name)} IS NOT NULL 
          AND TRIM(COALESCE(${sql.identifier(field.name)}::text, '')) != ''
          ORDER BY RANDOM() 
          LIMIT 3
        `;
      }

      const [completedResult, lengthResult, sampleResult] = await Promise.all([
        db.execute(completedQuery),
        db.execute(lengthQuery),
        db.execute(sampleQuery)
      ]);

      const completedStudies = Number(completedResult.rows[0].completed);
      const avgLength = lengthResult.rows[0].avg_length ? Number(lengthResult.rows[0].avg_length) : 0;
      const sampleValues = sampleResult.rows.map(row => {
        const value = row.value;
        if (isArrayField && Array.isArray(value)) {
          return value.join(', ');
        }
        return String(value).substring(0, 100);
      });

      results.push({
        fieldName: field.name,
        totalStudies,
        completedStudies,
        completionPercentage: Math.round((completedStudies / totalStudies) * 10000) / 100,
        avgLength: Math.round(avgLength * 10) / 10,
        sampleValues
      });

    } catch (error) {
      console.log(`Error auditing field ${field.name}:`, error);
      results.push({
        fieldName: field.name,
        totalStudies,
        completedStudies: 0,
        completionPercentage: 0,
        sampleValues: []
      });
    }
  }

  return results;
}

function displayAuditResults(metrics: DataQualityMetrics) {
  console.log('\n='.repeat(80));
  console.log('DATA COMPLETENESS AUDIT REPORT');
  console.log('='.repeat(80));
  console.log(`Total Studies: ${metrics.totalStudies}`);
  console.log(`Overall Completeness: ${metrics.overallCompleteness}%`);
  console.log('='.repeat(80));

  const sections = [
    { name: 'CORE ACADEMIC FIELDS', fields: metrics.coreFields },
    { name: 'ENHANCED CONTENT FIELDS', fields: metrics.enhancedFields },
    { name: 'RESEARCH LINKS & VERIFICATION', fields: metrics.researchLinks },
    { name: 'CONTENT & MEDIA', fields: metrics.contentFields },
    { name: 'METADATA & CLASSIFICATION', fields: metrics.metadata }
  ];

  sections.forEach(section => {
    console.log(`\n${section.name}:`);
    console.log('-'.repeat(40));
    
    section.fields.forEach(field => {
      const status = field.completionPercentage === 100 ? '✅' : 
                    field.completionPercentage >= 80 ? '🟡' : '🔴';
      
      console.log(`${status} ${field.fieldName.padEnd(20)} ${field.completionPercentage.toString().padStart(6)}% (${field.completedStudies}/${field.totalStudies})`);
      
      if (field.avgLength && field.avgLength > 0) {
        console.log(`    Avg Length: ${field.avgLength} chars`);
      }
      
      if (field.sampleValues.length > 0) {
        console.log(`    Sample: ${field.sampleValues[0].substring(0, 60)}...`);
      }
    });
    
    const sectionAvg = section.fields.reduce((sum, field) => sum + field.completionPercentage, 0) / section.fields.length;
    console.log(`    Section Average: ${Math.round(sectionAvg * 100) / 100}%`);
  });

  console.log('\n='.repeat(80));
  console.log('SUMMARY RECOMMENDATIONS:');
  console.log('='.repeat(80));

  // Identify priority areas for improvement
  const allFields = [...metrics.coreFields, ...metrics.enhancedFields, ...metrics.researchLinks, ...metrics.contentFields, ...metrics.metadata];
  const incompleteFields = allFields.filter(field => field.completionPercentage < 80).sort((a, b) => a.completionPercentage - b.completionPercentage);

  if (incompleteFields.length === 0) {
    console.log('🎉 Excellent! All fields have 80%+ completion rates.');
  } else {
    console.log('\nFields needing attention (below 80% completion):');
    incompleteFields.slice(0, 5).forEach((field, index) => {
      console.log(`${index + 1}. ${field.fieldName}: ${field.completionPercentage}% (${field.totalStudies - field.completedStudies} studies missing)`);
    });
  }

  console.log('\n='.repeat(80));
}

// Run the audit
auditDataCompleteness()
  .then(metrics => {
    displayAuditResults(metrics);
    console.log('\nData completeness audit completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Data audit failed:', error);
    process.exit(1);
  });