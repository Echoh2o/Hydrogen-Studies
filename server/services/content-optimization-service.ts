/**
 * Content Optimization Service
 * Handles content relationship tracking, update detection, and orchestration
 */

import { db } from "../db";
import {
  studies,
  blogArticles,
  contentRelationships,
  contentVersions,
  updateNotifications,
  contentDependencies,
  updateHistory,
  smartLinks,
  ContentRelationship,
  ContentVersion,
  UpdateNotification,
  ContentDependency,
  UpdateHistory,
  SmartLink,
  InsertContentRelationship,
  InsertContentVersion,
  InsertUpdateNotification,
  InsertContentDependency,
  InsertUpdateHistory,
  InsertSmartLink,
} from "@shared/schema";
import { eq, and, or, desc, asc, sql, inArray, gte, lte } from "drizzle-orm";
import OpenAI from "openai";
import {
  handleOpenAIRequest,
  handleBatchOperation,
} from "../utils/service-error-handlers";
import { AppError, ErrorCode } from "../utils/app-errors";

// Initialize OpenAI for content analysis
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
      maxRetries: 2,
    })
  : null;

export interface RelationshipDetectionResult {
  relationships: InsertContentRelationship[];
  dependencies: InsertContentDependency[];
}

export interface UpdateDetectionResult {
  notifications: InsertUpdateNotification[];
  priority: "critical" | "high" | "medium" | "low";
  summary: string;
}

export class ContentOptimizationService {
  /**
   * Detect and track relationships between content pieces
   */
  async detectContentRelationships(
    sourceType: "blog" | "study",
    sourceId: number,
  ): Promise<RelationshipDetectionResult> {
    try {
      // Get source content
      const sourceContent = await this.getContentById(sourceType, sourceId);
      if (!sourceContent) {
        throw new AppError(
          "Source content not found",
          404,
          ErrorCode.NOT_FOUND,
        );
      }

      // Find related studies based on content
      const relatedStudies = await db
        .select()
        .from(studies)
        .where(
          or(
            sql`${studies.keywords} && ARRAY[${sql.join(
              sourceContent.keywords || [],
              sql`, `,
            )}]`,
            sql`${studies.category} = ${sourceContent.category}`,
            sql`SIMILARITY(${studies.title}, ${sourceContent.title}) > 0.3`,
          ),
        )
        .limit(20);

      // Find related blogs if source is a study
      const relatedBlogs =
        sourceType === "study"
          ? await db
              .select()
              .from(blogArticles)
              .where(eq(blogArticles.studyId, sourceId))
          : [];

      // Use AI to detect relationship types
      const relationships: InsertContentRelationship[] = [];
      const dependencies: InsertContentDependency[] = [];

      if (openai) {
        // Analyze relationships using AI
        for (const relatedStudy of relatedStudies) {
          const relationship = await this.analyzeRelationship(
            sourceContent,
            relatedStudy,
            sourceType,
            "study",
          );
          if (relationship) {
            relationships.push({
              sourceType,
              sourceId,
              targetType: "study",
              targetId: relatedStudy.id,
              relationshipType: relationship.type,
              confidence: relationship.confidence,
              autoDetected: true,
              notes: relationship.notes,
            });

            // Create dependency if it's a critical relationship
            if (["references", "supports"].includes(relationship.type)) {
              dependencies.push({
                contentType: sourceType,
                contentId: sourceId,
                dependencyType: "study",
                dependencyId: relatedStudy.id,
                dependencyDetails: JSON.stringify({
                  title: relatedStudy.title,
                  doi: relatedStudy.doi,
                  relationship: relationship.type,
                }),
                importance: relationship.confidence > 80 ? "high" : "normal",
              });
            }
          }
        }

        // Analyze blog relationships
        for (const relatedBlog of relatedBlogs) {
          relationships.push({
            sourceType: "study",
            sourceId,
            targetType: "blog",
            targetId: relatedBlog.id,
            relationshipType: "references",
            confidence: 100,
            autoDetected: true,
            notes: "Blog article based on this study",
          });
        }
      }

      // Save relationships and dependencies
      if (relationships.length > 0) {
        await db.insert(contentRelationships).values(relationships);
      }
      if (dependencies.length > 0) {
        await db.insert(contentDependencies).values(dependencies);
      }

      return { relationships, dependencies };
    } catch (error) {
      console.error("Error detecting content relationships:", error);
      throw error;
    }
  }

  /**
   * Detect when content needs updates based on new research
   */
  async detectUpdateNeeds(newStudyId: number): Promise<UpdateDetectionResult> {
    try {
      const newStudy = await db
        .select()
        .from(studies)
        .where(eq(studies.id, newStudyId))
        .limit(1);

      if (!newStudy[0]) {
        throw new AppError("Study not found", 404, ErrorCode.NOT_FOUND);
      }

      const study = newStudy[0];
      const notifications: InsertUpdateNotification[] = [];

      // Find content that might need updates
      const relatedContent = await this.findRelatedContent(study);

      for (const content of relatedContent) {
        const updateNeeded = await this.checkIfUpdateNeeded(content, study);

        if (updateNeeded) {
          const priority = this.calculateUpdatePriority(updateNeeded);

          notifications.push({
            contentType: content.type as "blog" | "study",
            contentId: content.id,
            triggerType: updateNeeded.triggerType,
            triggerContentId: newStudyId,
            priority,
            priorityScore: updateNeeded.score,
            status: "pending",
            updateSummary: updateNeeded.summary,
            suggestedChanges: updateNeeded.changes,
            impactedSections: updateNeeded.sections,
          });
        }
      }

      // Save notifications
      if (notifications.length > 0) {
        await db.insert(updateNotifications).values(notifications);
      }

      // Determine overall priority
      const maxPriority = notifications.reduce(
        (max: string, n: any) => {
          const priorities = ["low", "medium", "high", "critical"];
          const nPriority = n.priority || "low";
          return priorities.indexOf(nPriority) > priorities.indexOf(max)
            ? nPriority
            : max;
        },
        "low",
      );

      return {
        notifications,
        priority: maxPriority as "high" | "low" | "medium" | "critical",
        summary: `Detected ${notifications.length} content pieces needing updates`,
      };
    } catch (error) {
      console.error("Error detecting update needs:", error);
      throw error;
    }
  }

  /**
   * Create a new version of content
   */
  async createContentVersion(
    contentType: "blog" | "study",
    contentId: number,
    updates: {
      title?: string;
      content?: string;
      summary?: string;
      changeNotes: string;
      changeReason: string;
      changedBy?: string;
    },
  ): Promise<ContentVersion> {
    try {
      // Get current content
      const currentContent = await this.getContentById(contentType, contentId);
      if (!currentContent) {
        throw new AppError("Content not found", 404, ErrorCode.NOT_FOUND);
      }

      // Get latest version number
      const latestVersion = await db
        .select()
        .from(contentVersions)
        .where(
          and(
            eq(contentVersions.contentType, contentType),
            eq(contentVersions.contentId, contentId),
          ),
        )
        .orderBy(desc(contentVersions.versionNumber))
        .limit(1);

      const versionNumber = latestVersion[0]
        ? latestVersion[0].versionNumber + 1
        : 1;
      const previousVersionId = latestVersion[0]?.id;

      // Set all previous versions to not latest
      if (previousVersionId) {
        await db
          .update(contentVersions)
          .set({ isLatest: false })
          .where(
            and(
              eq(contentVersions.contentType, contentType),
              eq(contentVersions.contentId, contentId),
            ),
          );
      }

      // Create new version
      const newVersion: InsertContentVersion = {
        contentType,
        contentId,
        versionNumber,
        title: updates.title || currentContent.title,
        content: updates.content || currentContent.content,
        summary: updates.summary || currentContent.summary,
        changeNotes: updates.changeNotes,
        changeReason: updates.changeReason,
        changedBy: updates.changedBy || "system",
        previousVersionId,
        isLatest: true,
      };

      const [createdVersion] = await db
        .insert(contentVersions)
        .values(newVersion)
        .returning();

      // Update the actual content
      if (
        contentType === "blog" &&
        (updates.title || updates.content || updates.summary)
      ) {
        await db
          .update(blogArticles)
          .set({
            title: updates.title || undefined,
            content: updates.content || undefined,
            summary: updates.summary || undefined,
            updatedAt: new Date(),
          })
          .where(eq(blogArticles.id, contentId));
      }

      // Log update history
      await this.logUpdateHistory({
        contentType,
        contentId,
        updateType: "manual_update",
        previousVersion: currentContent.content,
        newVersion: updates.content || currentContent.content,
        changedFields: Object.keys(updates).filter(
          (k) => updates[k as keyof typeof updates],
        ),
        changeDescription: updates.changeNotes,
        performedBy: updates.changedBy || "system",
      });

      return createdVersion;
    } catch (error) {
      console.error("Error creating content version:", error);
      throw error;
    }
  }

  /**
   * Generate smart internal links for SEO
   */
  async generateSmartLinks(
    contentType: "blog" | "study",
    contentId: number,
  ): Promise<SmartLink[]> {
    try {
      const content = await this.getContentById(contentType, contentId);
      if (!content) {
        throw new AppError("Content not found", 404, ErrorCode.NOT_FOUND);
      }

      const links: InsertSmartLink[] = [];

      // Find related content for linking
      const relatedContent = await this.findRelatedContent(content);

      for (const related of relatedContent.slice(0, 10)) {
        // Generate appropriate anchor text
        const anchorText = await this.generateAnchorText(content, related);

        if (anchorText) {
          links.push({
            fromType: contentType,
            fromId: contentId,
            toType: related.type as "blog" | "study",
            toId: related.id,
            anchorText,
            context: this.extractContext(content.content, anchorText),
            relevanceScore: this.calculateRelevanceScore(content, related),
            linkType: this.determineLinkType(content, related),
            autoGenerated: true,
            isActive: true,
          });
        }
      }

      // Save smart links
      if (links.length > 0) {
        const savedLinks = await db
          .insert(smartLinks)
          .values(links)
          .returning();
        return savedLinks;
      }

      return [];
    } catch (error) {
      console.error("Error generating smart links:", error);
      throw error;
    }
  }

  /**
   * Get pending update notifications for review
   */
  async getPendingNotifications(filters?: {
    priority?: string;
    contentType?: string;
    limit?: number;
  }): Promise<UpdateNotification[]> {
    let query = db
      .select()
      .from(updateNotifications)
      .where(eq(updateNotifications.status, "pending"))
      .$dynamic();

    if (filters?.priority) {
      query = query.where(eq(updateNotifications.priority, filters.priority));
    }
    if (filters?.contentType) {
      query = query.where(
        eq(updateNotifications.contentType, filters.contentType),
      );
    }

    query = query.orderBy(
      desc(updateNotifications.priorityScore),
      desc(updateNotifications.createdAt),
    );

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    return await query;
  }

  /**
   * Apply an update notification
   */
  async applyUpdateNotification(
    notificationId: number,
    reviewedBy: string,
  ): Promise<void> {
    try {
      const [notification] = await db
        .select()
        .from(updateNotifications)
        .where(eq(updateNotifications.id, notificationId))
        .limit(1);

      if (!notification) {
        throw new AppError("Notification not found", 404, ErrorCode.NOT_FOUND);
      }

      // Apply suggested changes
      if (notification.suggestedChanges) {
        await this.createContentVersion(
          notification.contentType as "blog" | "study",
          notification.contentId,
          {
            content: notification.suggestedChanges,
            changeNotes:
              notification.updateSummary || "Applied update notification",
            changeReason: notification.triggerType,
            changedBy: reviewedBy,
          },
        );
      }

      // Update notification status
      await db
        .update(updateNotifications)
        .set({
          status: "applied",
          reviewedBy,
          reviewedAt: new Date(),
          appliedAt: new Date(),
        })
        .where(eq(updateNotifications.id, notificationId));

      // Log to update history
      await this.logUpdateHistory({
        contentType: notification.contentType,
        contentId: notification.contentId,
        updateType: "auto_update",
        changeDescription: notification.updateSummary || "",
        performedBy: reviewedBy,
        notificationId,
      });
    } catch (error) {
      console.error("Error applying update notification:", error);
      throw error;
    }
  }

  // Private helper methods
  private async getContentById(type: string, id: number): Promise<any> {
    if (type === "blog") {
      const [blog] = await db
        .select()
        .from(blogArticles)
        .where(eq(blogArticles.id, id))
        .limit(1);
      return blog;
    } else if (type === "study") {
      const [study] = await db
        .select()
        .from(studies)
        .where(eq(studies.id, id))
        .limit(1);
      return study;
    }
    return null;
  }

  private async analyzeRelationship(
    source: any,
    target: any,
    sourceType: string,
    targetType: string,
  ): Promise<{ type: string; confidence: number; notes: string } | null> {
    if (!openai) return null;

    try {
      const response = await handleOpenAIRequest(
        async () => {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content:
                  "Analyze the relationship between two pieces of content and identify the relationship type: 'supports', 'contradicts', 'references', 'extends', or 'updates'. Return a JSON object with type, confidence (0-100), and notes.",
              },
              {
                role: "user",
                content: `Source (${sourceType}): "${source.title}"\nSummary: ${source.summary || source.abstract}\n\nTarget (${targetType}): "${target.title}"\nSummary: ${target.summary || target.abstract}`,
              },
            ],
            max_tokens: 200,
            temperature: 0.3,
          });

          const result = JSON.parse(
            completion.choices[0].message.content || "{}",
          );
          return result;
        },
        () => null,
      );
      return response;
    } catch (error) {
      console.error("Error analyzing relationship:", error);
      return null;
    }
  }

  private async findRelatedContent(content: any): Promise<any[]> {
    const related: any[] = [];

    // Find related blogs
    const blogs = await db
      .select()
      .from(blogArticles)
      .where(
        or(
          sql`${blogArticles.articleType} = ${content.category}`,
          sql`SIMILARITY(${blogArticles.title}, ${content.title}) > 0.2`,
        ),
      )
      .limit(10);

    related.push(...blogs.map((b) => ({ ...b, type: "blog" })));

    // Find related studies
    if (content.keywords && content.keywords.length > 0) {
      const relatedStudies = await db
        .select()
        .from(studies)
        .where(
          sql`${studies.keywords} && ARRAY[${sql.join(content.keywords, sql`, `)}]`,
        )
        .limit(10);

      related.push(...relatedStudies.map((s) => ({ ...s, type: "study" })));
    }

    return related;
  }

  private async checkIfUpdateNeeded(content: any, newStudy: any): Promise<any> {
    if (!openai) return null;

    try {
      const response = await handleOpenAIRequest(
        async () => {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content:
                  "Analyze if existing content needs updates based on new research. Return JSON with: updateNeeded (boolean), triggerType ('contradicting_evidence', 'supporting_evidence', 'new_data'), score (0-100 priority), summary, changes (suggested text changes), sections (array of impacted sections).",
              },
              {
                role: "user",
                content: `Existing content: "${content.title}"\nSummary: ${content.summary}\n\nNew study: "${newStudy.title}"\nFindings: ${newStudy.conclusion}`,
              },
            ],
            max_tokens: 500,
            temperature: 0.3,
          });

          const result = JSON.parse(
            completion.choices[0].message.content || "{}",
          );
          return result.updateNeeded ? result : null;
        },
        () => null,
      );
      return response;
    } catch (error) {
      console.error("Error checking update needs:", error);
      return null;
    }
  }

  private calculateUpdatePriority(
    updateInfo: any,
  ): "critical" | "high" | "medium" | "low" {
    if (updateInfo.score >= 80) return "critical";
    if (updateInfo.score >= 60) return "high";
    if (updateInfo.score >= 40) return "medium";
    return "low";
  }

  private async generateAnchorText(source: any, target: any): Promise<string> {
    // Simple anchor text generation - can be enhanced with AI
    const targetTitle = target.title.toLowerCase();
    const keywords = target.keywords || [];

    if (keywords.length > 0) {
      return keywords[0];
    }

    // Extract key phrase from title
    const titleWords = targetTitle.split(" ");
    if (titleWords.length > 3) {
      return titleWords.slice(0, 3).join(" ");
    }

    return targetTitle;
  }

  private extractContext(content: string, anchorText: string): string {
    const index = content.toLowerCase().indexOf(anchorText.toLowerCase());
    if (index === -1) return "";

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + anchorText.length + 50);

    return content.substring(start, end);
  }

  private calculateRelevanceScore(source: any, target: any): number {
    let score = 0;

    // Category match
    if (source.category === target.category) score += 30;

    // Keyword overlap
    const sourceKeywords = source.keywords || [];
    const targetKeywords = target.keywords || [];
    const overlap = sourceKeywords.filter((k: string) =>
      targetKeywords.includes(k),
    );
    score += Math.min(30, overlap.length * 10);

    // Date proximity (newer content is more relevant)
    const sourcDate = new Date(source.createdAt || source.publishDate);
    const targetDate = new Date(target.createdAt || target.publishDate);
    const daysDiff =
      Math.abs(sourcDate.getTime() - targetDate.getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysDiff < 30) score += 20;
    else if (daysDiff < 90) score += 10;

    // Title similarity
    const titleSimilarity = this.calculateTextSimilarity(
      source.title,
      target.title,
    );
    score += Math.min(20, titleSimilarity * 20);

    return Math.min(100, score);
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(" "));
    const words2 = new Set(text2.toLowerCase().split(" "));
    const intersection = new Set(Array.from(words1).filter((x) => words2.has(x)));
    const union = new Set([...Array.from(words1), ...Array.from(words2)]);
    return intersection.size / union.size;
  }

  private determineLinkType(source: any, target: any): string {
    if (source.category === target.category) return "related";
    if (target.createdAt > source.createdAt) return "update";
    return "contextual";
  }

  private async logUpdateHistory(data: InsertUpdateHistory): Promise<void> {
    await db.insert(updateHistory).values(data);
  }
}

// Export singleton instance
export const contentOptimizationService = new ContentOptimizationService();
