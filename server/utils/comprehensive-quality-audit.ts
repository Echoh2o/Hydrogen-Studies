import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const sql = neon(process.env.DATABASE_URL!);

interface QualityIssue {
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  issue: string;
  location?: string;
  recommendation: string;
}

export class ComprehensiveQualityAudit {
  private issues: QualityIssue[] = [];

  async runFullAudit(): Promise<{
    summary: {
      totalIssues: number;
      criticalIssues: number;
      highIssues: number;
      mediumIssues: number;
      lowIssues: number;
    };
    issues: QualityIssue[];
    recommendations: string[];
  }> {
    console.log("🔍 Starting comprehensive quality audit...");

    await Promise.all([
      this.auditDatabase(),
      this.auditCodeQuality(),
      this.auditSecurity(),
      this.auditPerformance(),
      this.auditSEO(),
      this.auditAccessibility(),
    ]);

    const summary = this.generateSummary();
    const recommendations = this.generateRecommendations();

    return {
      summary,
      issues: this.issues,
      recommendations,
    };
  }

  private async auditDatabase(): Promise<void> {
    try {
      // Check for duplicate studies
      const duplicates = await sql`
        SELECT doi, COUNT(*) as count
        FROM studies 
        WHERE doi IS NOT NULL AND doi != ''
        GROUP BY doi 
        HAVING COUNT(*) > 1
        LIMIT 5
      `;

      if (duplicates.length > 0) {
        this.addIssue(
          "database",
          "medium",
          `Found ${duplicates.length} duplicate DOIs in studies`,
          "database/studies",
          "Review and merge duplicate studies based on DOI",
        );
      }

      // Check for missing critical fields
      const missingData = await sql`
        SELECT 
          COUNT(CASE WHEN title IS NULL OR title = '' THEN 1 END) as missing_titles,
          COUNT(CASE WHEN abstract IS NULL OR abstract = '' THEN 1 END) as missing_abstracts,
          COUNT(CASE WHEN authors IS NULL OR authors = '' THEN 1 END) as missing_authors
        FROM studies
      `;

      if (Number(missingData[0].missing_titles) > 0) {
        this.addIssue(
          "database",
          "critical",
          `${missingData[0].missing_titles} studies missing titles`,
          "database/studies",
          "Add titles to all studies for proper indexing",
        );
      }

      // Check for broken image URLs
      const brokenImages = await sql`
        SELECT COUNT(*) as count
        FROM studies 
        WHERE image_url LIKE 'http%' 
        AND image_url NOT LIKE '%localhost%'
        AND image_url NOT LIKE '%replit%'
      `;

      if (Number(brokenImages[0].count) > 0) {
        this.addIssue(
          "database",
          "medium",
          `${brokenImages[0].count} studies with potentially broken external image URLs`,
          "database/studies",
          "Migrate external images to local storage",
        );
      }
    } catch (error) {
      this.addIssue(
        "database",
        "high",
        "Database audit failed",
        "database",
        "Check database connectivity and query performance",
      );
    }
  }

  private async auditCodeQuality(): Promise<void> {
    // Check for duplicate files
    const duplicateFiles = [
      "client/src/pages/admin/BlogsManagementPage.tsx",
      "client/src/pages/admin/BlogsAdmin.tsx",
      "client/src/pages/admin/BlogsPage.tsx",
    ];

    for (const file of duplicateFiles) {
      if (fs.existsSync(file)) {
        this.addIssue(
          "code",
          "medium",
          "Duplicate admin components found",
          file,
          "Consolidate duplicate components into single reusable component",
        );
      }
    }

    // Check for backup files
    const backupPattern = /\.backup$/;
    const checkBackupFiles = (dir: string) => {
      if (!fs.existsSync(dir)) return;

      const files = fs.readdirSync(dir, { recursive: true });
      files.forEach((file) => {
        if (typeof file === "string" && backupPattern.test(file)) {
          this.addIssue(
            "code",
            "low",
            "Backup file found in repository",
            path.join(dir, file),
            "Remove backup files from repository",
          );
        }
      });
    };

    checkBackupFiles("client/src");
    checkBackupFiles("server");

    // Check for overly large files
    const checkFileSize = (dir: string, maxSize: number = 1000) => {
      if (!fs.existsSync(dir)) return;

      const files = fs.readdirSync(dir, { recursive: true });
      files.forEach((file) => {
        if (
          typeof file === "string" &&
          (file.endsWith(".tsx") || file.endsWith(".ts"))
        ) {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          const lines = fs.readFileSync(filePath, "utf8").split("\n").length;

          if (lines > maxSize) {
            this.addIssue(
              "code",
              "medium",
              `Large file detected (${lines} lines)`,
              filePath,
              "Consider breaking down large files into smaller modules",
            );
          }
        }
      });
    };

    checkFileSize("client/src", 500);
    checkFileSize("server", 300);
  }

  private async auditSecurity(): Promise<void> {
    // Check for hardcoded secrets (basic check)
    const checkForSecrets = (dir: string) => {
      if (!fs.existsSync(dir)) return;

      const files = fs.readdirSync(dir, { recursive: true });
      files.forEach((file) => {
        if (
          typeof file === "string" &&
          (file.endsWith(".tsx") || file.endsWith(".ts"))
        ) {
          const filePath = path.join(dir, file);
          const content = fs.readFileSync(filePath, "utf8");

          // Look for potential API keys or secrets
          const secretPatterns = [
            /sk-[a-zA-Z0-9]{48}/g, // OpenAI API keys
            /xoxb-[a-zA-Z0-9-]+/g, // Slack tokens
            /AKIA[0-9A-Z]{16}/g, // AWS access keys
          ];

          secretPatterns.forEach((pattern) => {
            if (pattern.test(content)) {
              this.addIssue(
                "security",
                "critical",
                "Potential hardcoded secret found",
                filePath,
                "Move secrets to environment variables",
              );
            }
          });
        }
      });
    };

    checkForSecrets("client/src");
    checkForSecrets("server");

    // Check for missing security headers
    if (!fs.existsSync("server/index.ts")) {
      this.addIssue(
        "security",
        "high",
        "Main server file not found",
        "server/index.ts",
        "Ensure server file exists and implements security headers",
      );
    } else {
      const serverContent = fs.readFileSync("server/index.ts", "utf8");
      if (!serverContent.includes("helmet")) {
        this.addIssue(
          "security",
          "medium",
          "Security headers middleware not found",
          "server/index.ts",
          "Add helmet.js for security headers",
        );
      }
    }
  }

  private async auditPerformance(): Promise<void> {
    // Check for large bundle sizes
    const checkBundleSize = async () => {
      try {
        const distPath = "client/dist";
        if (fs.existsSync(distPath)) {
          const files = fs.readdirSync(distPath, { recursive: true });
          files.forEach((file) => {
            if (typeof file === "string" && file.endsWith(".js")) {
              const filePath = path.join(distPath, file);
              const stats = fs.statSync(filePath);
              const sizeMB = stats.size / (1024 * 1024);

              if (sizeMB > 1) {
                this.addIssue(
                  "performance",
                  "medium",
                  `Large JavaScript bundle detected (${sizeMB.toFixed(2)}MB)`,
                  filePath,
                  "Consider code splitting and lazy loading",
                );
              }
            }
          });
        }
      } catch (error) {
        // Build files may not exist yet
      }
    };

    await checkBundleSize();

    // Check for unoptimized images
    const checkImages = () => {
      const uploadsPath = "uploads/study-images";
      if (fs.existsSync(uploadsPath)) {
        const files = fs.readdirSync(uploadsPath);
        files.forEach((file) => {
          if (file.endsWith(".png") || file.endsWith(".jpg")) {
            const filePath = path.join(uploadsPath, file);
            const stats = fs.statSync(filePath);
            const sizeMB = stats.size / (1024 * 1024);

            if (sizeMB > 0.5) {
              this.addIssue(
                "performance",
                "low",
                `Large image file detected (${sizeMB.toFixed(2)}MB)`,
                filePath,
                "Optimize images using compression or WebP format",
              );
            }
          }
        });
      }
    };

    checkImages();
  }

  private async auditSEO(): Promise<void> {
    // Check for missing meta tags in key pages
    const keyPages = [
      "client/src/pages/HomePage.tsx",
      "client/src/pages/SearchPage.tsx",
      "client/src/pages/StudyPage.tsx",
    ];

    keyPages.forEach((page) => {
      if (fs.existsSync(page)) {
        const content = fs.readFileSync(page, "utf8");
        if (!content.includes("Helmet") && !content.includes("title")) {
          this.addIssue(
            "seo",
            "medium",
            "Missing SEO meta tags",
            page,
            "Add React Helmet with proper title, description, and meta tags",
          );
        }
      }
    });

    // Check for missing sitemap
    if (!fs.existsSync("public/sitemap.xml")) {
      this.addIssue(
        "seo",
        "medium",
        "Missing sitemap.xml",
        "public/sitemap.xml",
        "Generate XML sitemap for better search engine indexing",
      );
    }
  }

  private async auditAccessibility(): Promise<void> {
    // Check for missing alt attributes (basic check)
    const checkAccessibility = (dir: string) => {
      if (!fs.existsSync(dir)) return;

      const files = fs.readdirSync(dir, { recursive: true });
      files.forEach((file) => {
        if (typeof file === "string" && file.endsWith(".tsx")) {
          const filePath = path.join(dir, file);
          const content = fs.readFileSync(filePath, "utf8");

          // Check for img tags without alt attributes
          const imgWithoutAlt = /<img(?![^>]*alt=)[^>]*>/g;
          if (imgWithoutAlt.test(content)) {
            this.addIssue(
              "accessibility",
              "medium",
              "Images without alt attributes found",
              filePath,
              "Add descriptive alt attributes to all images",
            );
          }

          // Check for buttons without accessible labels
          const buttonWithoutLabel =
            /<button(?![^>]*aria-label)(?![^>]*>.*[a-zA-Z])[^>]*>/g;
          if (buttonWithoutLabel.test(content)) {
            this.addIssue(
              "accessibility",
              "medium",
              "Buttons without accessible labels found",
              filePath,
              "Add aria-label or visible text to all buttons",
            );
          }
        }
      });
    };

    checkAccessibility("client/src");
  }

  private addIssue(
    category: string,
    severity: "low" | "medium" | "high" | "critical",
    issue: string,
    location?: string,
    recommendation?: string,
  ): void {
    this.issues.push({
      category,
      severity,
      issue,
      location,
      recommendation: recommendation || "Review and fix this issue",
    });
  }

  private generateSummary() {
    const summary = {
      totalIssues: this.issues.length,
      criticalIssues: this.issues.filter((i) => i.severity === "critical")
        .length,
      highIssues: this.issues.filter((i) => i.severity === "high").length,
      mediumIssues: this.issues.filter((i) => i.severity === "medium").length,
      lowIssues: this.issues.filter((i) => i.severity === "low").length,
    };

    return summary;
  }

  private generateRecommendations(): string[] {
    const recommendations = [
      "1. Fix all critical issues immediately",
      "2. Address high-priority security and performance issues",
      "3. Improve code organization by removing duplicates",
      "4. Add comprehensive error handling",
      "5. Implement proper SEO meta tags",
      "6. Improve accessibility with proper ARIA labels",
      "7. Optimize images and bundle sizes",
      "8. Add automated quality checks to CI/CD",
    ];

    return recommendations;
  }
}

export const qualityAudit = new ComprehensiveQualityAudit();
