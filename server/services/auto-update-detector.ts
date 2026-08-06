/**
 * Auto-Update Detection Worker
 * Monitors for new studies and triggers content update detection
 */

import { db } from "../db";
import {
  studies,
  blogArticles,
  updateNotifications,
  contentRelationships,
  InsertUpdateNotification,
} from "@shared/schema";
import { eq, and, or, desc, gte, sql } from "drizzle-orm";
import { contentOptimizationService } from "./content-optimization-service";
import { ai } from "./ai-provider";
import { handleOpenAIRequest } from "../utils/service-error-handlers";
import { AppError, ErrorCode } from "../utils/app-errors";

interface UpdateCheck {
  contentId: number;
  contentType: "blog" | "study";
  reason: string;
  priority: number;
  suggestedChanges?: string[];
  /** Id of the study that triggered this check, for notification provenance. */
  triggerStudyId?: number;
}

export class AutoUpdateDetector {
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Start the auto-update detection process
   */
  start(intervalMinutes = 60) {
    if (this.isRunning) {
      console.log("Auto-update detector is already running");
      return;
    }

    this.isRunning = true;
    console.log(
      `Starting auto-update detector with ${intervalMinutes} minute interval`,
    );

    // Run initial check
    this.checkForUpdates();

    // Set up recurring check
    this.checkInterval = setInterval(
      () => {
        this.checkForUpdates();
      },
      intervalMinutes * 60 * 1000,
    );
  }

  /**
   * Stop the auto-update detection process
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log("Auto-update detector stopped");
  }

  /**
   * Check for content that needs updates
   */
  async checkForUpdates() {
    try {
      console.log("Running auto-update detection check...");

      // Get recently added studies (last 7 days)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const recentStudies = await db
        .select()
        .from(studies)
        .where(gte(studies.createdAt, oneWeekAgo))
        .orderBy(desc(studies.createdAt));

      console.log(`Found ${recentStudies.length} recent studies to analyze`);

      const updateChecks: UpdateCheck[] = [];

      // Process each new study
      for (const study of recentStudies) {
        // Check if we've already processed this study
        const existingNotifications = await db
          .select()
          .from(updateNotifications)
          .where(eq(updateNotifications.triggerContentId, study.id))
          .limit(1);

        if (existingNotifications.length === 0) {
          // Find content that might need updates
          const impactedContent = await this.findImpactedContent(study);
          updateChecks.push(...impactedContent);

          // Also detect relationships for the new study
          await contentOptimizationService.detectContentRelationships(
            "study",
            study.id,
          );
        }
      }

      // Process update checks and create notifications
      await this.processUpdateChecks(updateChecks, recentStudies);

      console.log(
        `Auto-update detection complete. Created ${updateChecks.length} update checks.`,
      );
    } catch (error) {
      console.error("Error in auto-update detection:", error);
    }
  }

  /**
   * Find content impacted by a new study
   */
  private async findImpactedContent(study: any): Promise<UpdateCheck[]> {
    const updateChecks: UpdateCheck[] = [];

    // Find blogs related to this study via a real shared dimension:
    // (1) blogs generated from a study in the same topical category
    //     (blog_articles.studyId → studies, matched on studies.category), and
    // (2) blogs whose semantic keywords overlap this study's keywords.
    // The former replaces a dead `articleType = study.category` branch —
    // articleType holds content types (science_explainer, faq, …), never a
    // topical category, so it could never match.
    const blogConditions = [
      sql`${blogArticles.studyId} IN (SELECT ${studies.id} FROM ${studies} WHERE ${studies.category} = ${study.category})`,
    ];
    if (Array.isArray(study.keywords) && study.keywords.length > 0) {
      blogConditions.push(
        sql`${blogArticles.semanticKeywords} && ${study.keywords}`,
      );
    }

    const relatedBlogs = await db
      .select()
      .from(blogArticles)
      .where(or(...blogConditions))
      .limit(20);

    // Analyze each blog for potential updates
    for (const blog of relatedBlogs) {
      const updateNeeded = await this.analyzeContentForUpdates(
        blog,
        study,
        "blog",
      );
      if (updateNeeded) {
        // Stamp the study that actually triggered this check so notifications
        // attribute provenance correctly (see processUpdateChecks).
        updateChecks.push({ ...updateNeeded, triggerStudyId: study.id });
      }
    }

    // Find studies that might be contradicted or supported
    const relatedStudies = await db
      .select()
      .from(studies)
      .where(
        and(
          eq(studies.category, study.category),
          sql`${studies.id} != ${study.id}`,
        ),
      )
      .limit(10);

    for (const relatedStudy of relatedStudies) {
      const relationship = await this.analyzeStudyRelationship(
        relatedStudy,
        study,
      );
      if (relationship && relationship.type === "contradicts") {
        updateChecks.push({
          contentId: relatedStudy.id,
          contentType: "study",
          reason: `New contradicting evidence from study: ${study.title}`,
          priority: 80,
          suggestedChanges: [
            `Add note about contradicting findings from ${study.title}`,
          ],
          triggerStudyId: study.id,
        });
      }
    }

    return updateChecks;
  }

  /**
   * Analyze if content needs updates based on new study
   */
  private async analyzeContentForUpdates(
    content: any,
    newStudy: any,
    contentType: "blog" | "study",
  ): Promise<UpdateCheck | null> {
    if (ai.getProviderStatus().primary === "none") {
      // Fallback logic without AI
      return this.simpleUpdateCheck(content, newStudy, contentType);
    }

    try {
      const systemPrompt = `Analyze if existing ${contentType} content needs updates based on new research. Consider:
                - Contradicting findings
                - New supporting evidence
                - Outdated statistics or claims
                - Missing important context
                Return JSON with: needsUpdate (boolean), reason (string), priority (0-100), suggestedChanges (array of strings)`;

      const userPrompt = `Existing ${contentType}: "${content.title}"
Content: ${content.content?.substring(0, 1000) || content.abstract?.substring(0, 1000)}

New study: "${newStudy.title}"
Findings: ${newStudy.conclusion || newStudy.results}
Published: ${newStudy.journalPublishDate}`;

      const result = await ai.generateJSON(systemPrompt, userPrompt, {
        maxTokens: 400,
        temperature: 0.3,
        model: "claude-haiku-4-5",
      });

      if (result.needsUpdate) {
        return {
          contentId: content.id,
          contentType,
          reason: result.reason,
          priority: result.priority,
          suggestedChanges: result.suggestedChanges,
        };
      }
      return null;
    } catch (error) {
      console.error("Error analyzing content for updates:", error);
      return this.simpleUpdateCheck(content, newStudy, contentType);
    }
  }

  /**
   * Simple update check without AI
   */
  private simpleUpdateCheck(
    content: any,
    newStudy: any,
    contentType: "blog" | "study",
  ): UpdateCheck | null {
    // Check if content references similar topics
    const contentKeywords = content.keywords || [];
    const studyKeywords = newStudy.keywords || [];
    const commonKeywords = contentKeywords.filter((k: string) =>
      studyKeywords.includes(k),
    );

    if (commonKeywords.length > 2) {
      // Check if new study is more recent
      const contentDate = new Date(
        content.journalPublishDate || content.createdAt,
      );
      const studyDate = new Date(
        newStudy.journalPublishDate || newStudy.createdAt,
      );

      if (studyDate > contentDate) {
        return {
          contentId: content.id,
          contentType,
          reason: `New related research available: ${newStudy.title}`,
          priority: 50,
          suggestedChanges: [
            `Consider adding reference to new study: ${newStudy.title}`,
            `Update statistics if newer data is available`,
          ],
        };
      }
    }

    return null;
  }

  /**
   * Analyze relationship between two studies
   */
  private async analyzeStudyRelationship(
    study1: any,
    study2: any,
  ): Promise<any> {
    if (ai.getProviderStatus().primary === "none") return null;

    try {
      const systemPrompt = "Analyze the relationship between two studies. Return JSON with: type ('supports', 'contradicts', 'extends', 'unrelated'), confidence (0-100), explanation (string)";

      const userPrompt = `Study 1: "${study1.title}"
Conclusion: ${study1.conclusion}

Study 2: "${study2.title}"
Conclusion: ${study2.conclusion}`;

      const result = await ai.generateJSON(systemPrompt, userPrompt, {
        maxTokens: 200,
        temperature: 0.3,
        model: "claude-haiku-4-5",
      });

      return result;
    } catch (error) {
      console.error("Error analyzing study relationship:", error);
      return null;
    }
  }

  /**
   * Process update checks and create notifications
   */
  private async processUpdateChecks(
    updateChecks: UpdateCheck[],
    triggerStudies: any[],
  ) {
    const notifications: InsertUpdateNotification[] = [];

    for (const check of updateChecks) {
      // Attribute the notification to the study that actually triggered this
      // check (stamped in findImpactedContent), falling back to the first
      // recent study only if it was somehow left unset.
      const triggerContentId = check.triggerStudyId ?? triggerStudies[0]?.id;

      // Determine priority level
      let priority: "critical" | "high" | "medium" | "low" = "medium";
      if (check.priority >= 80) priority = "critical";
      else if (check.priority >= 60) priority = "high";
      else if (check.priority >= 40) priority = "medium";
      else priority = "low";

      notifications.push({
        contentType: check.contentType,
        contentId: check.contentId,
        triggerType: check.reason.includes("contradict")
          ? "contradicting_evidence"
          : check.reason.includes("support")
            ? "supporting_evidence"
            : "new_study",
        triggerContentId,
        priority,
        priorityScore: check.priority,
        status: "pending",
        updateSummary: check.reason,
        suggestedChanges: check.suggestedChanges?.join("\n"),
        impactedSections: [],
      });
    }

    // Save notifications in batch
    if (notifications.length > 0) {
      await db.insert(updateNotifications).values(notifications);
      console.log(`Created ${notifications.length} update notifications`);
    }
  }

  /**
   * Manually trigger update detection for a specific study
   */
  async detectUpdatesForStudy(studyId: number): Promise<UpdateCheck[]> {
    try {
      const [study] = await db
        .select()
        .from(studies)
        .where(eq(studies.id, studyId))
        .limit(1);

      if (!study) {
        throw new AppError("Study not found", 404, ErrorCode.NOT_FOUND);
      }

      const updateChecks = await this.findImpactedContent(study);
      await this.processUpdateChecks(updateChecks, [study]);

      return updateChecks;
    } catch (error) {
      console.error("Error detecting updates for study:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const autoUpdateDetector = new AutoUpdateDetector();
