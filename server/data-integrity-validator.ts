import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

interface IntegrityIssue {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  count: number;
  examples: any[];
}

export class DataIntegrityValidator {
  async validateDataIntegrity(): Promise<{
    issues: IntegrityIssue[];
    totalIssues: number;
    criticalIssues: number;
    recommendations: string[];
  }> {
    console.log("🔍 Running comprehensive data integrity validation...");

    const issues: IntegrityIssue[] = [];

    // Check for duplicate studies by DOI
    const duplicateDois = await sql`
      SELECT doi, COUNT(*) as count, array_agg(id) as study_ids
      FROM studies 
      WHERE doi IS NOT NULL AND doi != ''
      GROUP BY doi 
      HAVING COUNT(*) > 1
      LIMIT 10
    `;

    if (duplicateDois.length > 0) {
      issues.push({
        type: "duplicate_doi",
        severity: "high",
        description: "Studies with duplicate DOI identifiers",
        count: duplicateDois.length,
        examples: duplicateDois.map((d) => ({ doi: d.doi, count: d.count })),
      });
    }

    // Check for studies with missing critical fields
    const missingTitles = await sql`
      SELECT COUNT(*) as count FROM studies WHERE title IS NULL OR title = ''
    `;

    if (Number(missingTitles[0].count) > 0) {
      issues.push({
        type: "missing_titles",
        severity: "critical",
        description: "Studies without titles",
        count: Number(missingTitles[0].count),
        examples: [],
      });
    }

    // Check for malformed publication dates
    const invalidDates = await sql`
      SELECT COUNT(*) as count FROM studies 
      WHERE publish_date IS NOT NULL 
      AND (publish_date > NOW() OR publish_date < '1950-01-01')
    `;

    if (Number(invalidDates[0].count) > 0) {
      issues.push({
        type: "invalid_dates",
        severity: "medium",
        description: "Studies with invalid publication dates",
        count: Number(invalidDates[0].count),
        examples: [],
      });
    }

    // Check for broken image URLs
    const missingImages = await sql`
      SELECT COUNT(*) as count FROM studies 
      WHERE image_url IS NULL OR image_url = ''
    `;

    if (Number(missingImages[0].count) > 0) {
      issues.push({
        type: "missing_images",
        severity: "low",
        description: "Studies without images",
        count: Number(missingImages[0].count),
        examples: [],
      });
    }

    // Check for studies without categories
    const uncategorized = await sql`
      SELECT COUNT(*) as count FROM studies 
      WHERE category IS NULL OR category = ''
    `;

    if (Number(uncategorized[0].count) > 0) {
      issues.push({
        type: "uncategorized",
        severity: "medium",
        description: "Studies without categories",
        count: Number(uncategorized[0].count),
        examples: [],
      });
    }

    // Check for extremely short abstracts (likely incomplete)
    const shortAbstracts = await sql`
      SELECT COUNT(*) as count FROM studies 
      WHERE abstract IS NOT NULL 
      AND LENGTH(abstract) < 100
    `;

    if (Number(shortAbstracts[0].count) > 0) {
      issues.push({
        type: "short_abstracts",
        severity: "low",
        description: "Studies with very short abstracts (possibly incomplete)",
        count: Number(shortAbstracts[0].count),
        examples: [],
      });
    }

    const totalIssues = issues.reduce((sum, issue) => sum + issue.count, 0);
    const criticalIssues = issues
      .filter((issue) => issue.severity === "critical")
      .reduce((sum, issue) => sum + issue.count, 0);

    const recommendations = this.generateRecommendations(issues);

    return {
      issues,
      totalIssues,
      criticalIssues,
      recommendations,
    };
  }

  private generateRecommendations(issues: IntegrityIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.some((i) => i.type === "duplicate_doi")) {
      recommendations.push(
        "Implement DOI uniqueness constraint and merge duplicate studies",
      );
    }

    if (issues.some((i) => i.type === "missing_titles")) {
      recommendations.push("Add validation to prevent studies without titles");
    }

    if (issues.some((i) => i.type === "invalid_dates")) {
      recommendations.push("Add date validation (1950-current year)");
    }

    if (issues.some((i) => i.type === "missing_images")) {
      recommendations.push(
        "Run bulk image generation for studies without images",
      );
    }

    if (issues.some((i) => i.type === "uncategorized")) {
      recommendations.push(
        "Implement automatic categorization for uncategorized studies",
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "Data integrity is excellent - no major issues detected",
      );
    }

    return recommendations;
  }

  async fixCommonIssues(): Promise<{ fixed: number; errors: string[] }> {
    const errors: string[] = [];
    let fixed = 0;

    try {
      // Fix empty titles by using first few words of abstract
      const result = await sql`
        UPDATE studies 
        SET title = LEFT(abstract, 100) || '...'
        WHERE (title IS NULL OR title = '') 
        AND abstract IS NOT NULL 
        AND LENGTH(abstract) > 10
      `;

      fixed += result.rowCount || 0;
    } catch (error) {
      errors.push(`Failed to fix missing titles: ${error}`);
    }

    try {
      // Set default category for uncategorized studies
      const result = await sql`
        UPDATE studies 
        SET category = 'General Health'
        WHERE category IS NULL OR category = ''
      `;

      fixed += result.rowCount || 0;
    } catch (error) {
      errors.push(`Failed to fix categories: ${error}`);
    }

    return { fixed, errors };
  }
}

export const dataIntegrityValidator = new DataIntegrityValidator();
