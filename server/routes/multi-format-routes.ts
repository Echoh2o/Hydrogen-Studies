/**
 * Multi-Format Content Generation API Routes
 */

import { Router, Request, Response } from "express";
import {
  generateMultiFormatContent,
  getStudyMultiFormatContent,
  updateMultiFormatContent,
  deleteMultiFormatContent,
  batchGenerateAllFormats,
  ContentFormat,
} from "../services/multi-format-generator";
import { db } from "../db";
import { multiFormatContent, studies } from "@shared/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { AppError, ErrorCode } from "../utils/app-errors";
import { requireAdmin } from "../auth";
import { safeJsonParse } from "../utils/sanitize";
import { escapeHtml } from "../utils/html-safety";
import { sanitizeArticleHtml } from "../utils/sanitize-html";

const router = Router();

/**
 * Generate multi-format content for a study
 * POST /api/multi-format/generate
 */
router.post("/generate", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { studyId, formats, options } = req.body;

    if (!studyId) {
      throw new AppError(
        "Study ID is required",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Fetch the study
    const study = await db.query.studies.findFirst({
      where: eq(studies.id, studyId),
    });

    if (!study) {
      throw new AppError("Study not found", 404, ErrorCode.NOT_FOUND);
    }

    // Parse formats or use all if not specified
    const selectedFormats =
      formats && Array.isArray(formats)
        ? formats.filter((f) => Object.values(ContentFormat).includes(f))
        : Object.values(ContentFormat);

    // Generate content
    const results = await generateMultiFormatContent(
      study,
      selectedFormats,
      options || {},
    );

    res.json({
      success: true,
      message: `Generated ${results.contents.length} format(s) successfully`,
      data: {
        generated: results.contents,
        errors: results.errors,
        warnings: results.warnings,
      },
    });
  } catch (error) {
    console.error("Error generating multi-format content:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to generate content",
    });
  }
});

/**
 * Get all multi-format content for a study
 * GET /api/multi-format/study/:studyId
 */
router.get("/study/:studyId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const studyId = parseInt(req.params.studyId);

    if (isNaN(studyId)) {
      throw new AppError("Invalid study ID", 400, ErrorCode.VALIDATION_ERROR);
    }

    const content = await getStudyMultiFormatContent(studyId);

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error("Error fetching multi-format content:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch content",
    });
  }
});

/**
 * Get specific format content
 * GET /api/multi-format/:id
 */
router.get("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const contentId = parseInt(req.params.id);

    if (isNaN(contentId)) {
      throw new AppError("Invalid content ID", 400, ErrorCode.VALIDATION_ERROR);
    }

    const content = await db.query.multiFormatContent.findFirst({
      where: eq(multiFormatContent.id, contentId),
    });

    if (!content) {
      throw new AppError("Content not found", 404, ErrorCode.NOT_FOUND);
    }

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error("Error fetching content:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch content",
    });
  }
});

/**
 * Update multi-format content
 * PUT /api/multi-format/:id
 */
router.put("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const contentId = parseInt(req.params.id);
    const updates = req.body;

    if (isNaN(contentId)) {
      throw new AppError("Invalid content ID", 400, ErrorCode.VALIDATION_ERROR);
    }

    // Strip fields that must not be client-settable: identity/ownership and
    // server-managed metrics/timestamps. (Drizzle's .set() already ignores
    // keys that aren't real columns, so this guards against tampering with
    // legitimate-but-sensitive columns rather than column injection.)
    for (const field of [
      "id",
      "createdAt",
      "updatedAt",
      "studyId",
      "publishedAt",
      "viewCount",
      "engagementScore",
      "shareCount",
      "clickThroughRate",
      "conversionMetrics",
    ]) {
      delete updates[field];
    }

    await updateMultiFormatContent(contentId, updates);

    res.json({
      success: true,
      message: "Content updated successfully",
    });
  } catch (error) {
    console.error("Error updating content:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update content",
    });
  }
});

/**
 * Delete multi-format content
 * DELETE /api/multi-format/:id
 */
router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const contentId = parseInt(req.params.id);

    if (isNaN(contentId)) {
      throw new AppError("Invalid content ID", 400, ErrorCode.VALIDATION_ERROR);
    }

    await deleteMultiFormatContent(contentId);

    res.json({
      success: true,
      message: "Content deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting content:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete content",
    });
  }
});

/**
 * Batch generate all formats for a study
 * POST /api/multi-format/batch-generate
 */
router.post("/batch-generate", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { studyId } = req.body;

    if (!studyId) {
      throw new AppError(
        "Study ID is required",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const result = await batchGenerateAllFormats(studyId);

    res.json({
      success: result.success,
      message: `Generated ${result.generated} formats`,
      data: result,
    });
  } catch (error) {
    console.error("Error in batch generation:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Batch generation failed",
    });
  }
});

/**
 * Get all multi-format content with pagination
 * GET /api/multi-format
 */
router.get("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    // Clamp limit: ?limit=1000000 would otherwise select the whole table.
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const formatType = req.query.formatType as string;
    const isPublished = req.query.isPublished === "true";

    // Build where conditions
    const conditions = [];
    if (formatType) {
      conditions.push(eq(multiFormatContent.formatType, formatType));
    }
    if (req.query.isPublished !== undefined) {
      conditions.push(eq(multiFormatContent.isPublished, isPublished));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get content with pagination
    const content = await db
      .select()
      .from(multiFormatContent)
      .where(whereClause)
      .orderBy(desc(multiFormatContent.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count via COUNT(*) — previously selected every row's id and
    // used .length, scanning the whole table on every page view.
    const [countResult] = await db
      .select({ count: count() })
      .from(multiFormatContent)
      .where(whereClause);

    const totalCount = countResult?.count ?? 0;

    res.json({
      success: true,
      data: content,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching multi-format content:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch content",
    });
  }
});

/**
 * Publish/unpublish content
 * POST /api/multi-format/:id/publish
 */
router.post("/:id/publish", requireAdmin, async (req: Request, res: Response) => {
  try {
    const contentId = parseInt(req.params.id);
    const { isPublished } = req.body;

    if (isNaN(contentId)) {
      throw new AppError("Invalid content ID", 400, ErrorCode.VALIDATION_ERROR);
    }

    await db
      .update(multiFormatContent)
      .set({
        isPublished: isPublished,
        publishedAt: isPublished ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(multiFormatContent.id, contentId));

    res.json({
      success: true,
      message: `Content ${isPublished ? "published" : "unpublished"} successfully`,
    });
  } catch (error) {
    console.error("Error updating publish status:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update publish status",
    });
  }
});

/**
 * Schedule content for future publication
 * POST /api/multi-format/:id/schedule
 */
router.post("/:id/schedule", requireAdmin, async (req: Request, res: Response) => {
  try {
    const contentId = parseInt(req.params.id);
    const { scheduledFor } = req.body;

    if (isNaN(contentId)) {
      throw new AppError("Invalid content ID", 400, ErrorCode.VALIDATION_ERROR);
    }

    if (!scheduledFor) {
      throw new AppError(
        "Scheduled date is required",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const scheduledDate = new Date(scheduledFor);
    if (scheduledDate <= new Date()) {
      throw new AppError(
        "Scheduled date must be in the future",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    await db
      .update(multiFormatContent)
      .set({
        scheduledFor: scheduledDate,
        updatedAt: new Date(),
      })
      .where(eq(multiFormatContent.id, contentId));

    res.json({
      success: true,
      message: `Content scheduled for ${scheduledDate.toISOString()}`,
    });
  } catch (error) {
    console.error("Error scheduling content:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to schedule content",
    });
  }
});

/**
 * Get content statistics
 * GET /api/multi-format/stats
 */
router.get("/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    // Get format distribution
    const formatStats = await db
      .select({
        formatType: multiFormatContent.formatType,
        count: multiFormatContent.id,
      })
      .from(multiFormatContent)
      .groupBy(multiFormatContent.formatType);

    // Get publishing stats
    const publishedCount = await db
      .select({ count: multiFormatContent.id })
      .from(multiFormatContent)
      .where(eq(multiFormatContent.isPublished, true));

    const unpublishedCount = await db
      .select({ count: multiFormatContent.id })
      .from(multiFormatContent)
      .where(eq(multiFormatContent.isPublished, false));

    // Get recent content
    const recentContent = await db
      .select()
      .from(multiFormatContent)
      .orderBy(desc(multiFormatContent.createdAt))
      .limit(5);

    res.json({
      success: true,
      data: {
        formatDistribution: formatStats,
        publishedCount: publishedCount.length,
        unpublishedCount: unpublishedCount.length,
        totalContent: publishedCount.length + unpublishedCount.length,
        recentContent: recentContent,
      },
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch statistics",
    });
  }
});

/**
 * Export content in specific format
 * GET /api/multi-format/:id/export
 */
router.get("/:id/export", requireAdmin, async (req: Request, res: Response) => {
  try {
    const contentId = parseInt(req.params.id);
    const exportFormat = (req.query.format as string) || "json";

    if (isNaN(contentId)) {
      throw new AppError("Invalid content ID", 400, ErrorCode.VALIDATION_ERROR);
    }

    const content = await db.query.multiFormatContent.findFirst({
      where: eq(multiFormatContent.id, contentId),
    });

    if (!content) {
      throw new AppError("Content not found", 404, ErrorCode.NOT_FOUND);
    }

    // Export based on format
    switch (exportFormat) {
      case "txt":
        // Export as plain text
        const textContent = generateTextExport(content);
        res.setHeader("Content-Type", "text/plain");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${content.formatType}_${content.id}.txt"`,
        );
        res.send(textContent);
        break;

      case "html":
        // Export as HTML
        const htmlContent = generateHtmlExport(content);
        res.setHeader("Content-Type", "text/html");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${content.formatType}_${content.id}.html"`,
        );
        res.send(htmlContent);
        break;

      case "json":
      default:
        // Export as JSON
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${content.formatType}_${content.id}.json"`,
        );
        res.json(content);
        break;
    }
  } catch (error) {
    console.error("Error exporting content:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to export content",
    });
  }
});

/**
 * Generate plain text export
 */
function generateTextExport(content: any): string {
  let text = `${content.title}\n${"=".repeat(content.title.length)}\n\n`;

  switch (content.formatType) {
    case ContentFormat.PODCAST:
      text += `PODCAST SCRIPT\n\n`;
      text += `Intro:\n${content.podcastIntro || ""}\n\n`;
      text += `Main Content:\n${content.podcastScript || ""}\n\n`;
      if (content.podcastQA) {
        text += `Q&A Segment:\n`;
        const qa = safeJsonParse<Array<{ question: string; answer: string }>>(content.podcastQA, []);
        qa.forEach((item) => {
          text += `Q: ${item.question}\nA: ${item.answer}\n\n`;
        });
      }
      text += `Outro:\n${content.podcastOutro || ""}\n\n`;
      text += `Show Notes:\n${content.podcastShowNotes || ""}\n`;
      break;

    case ContentFormat.SOCIAL_TWITTER:
    case ContentFormat.SOCIAL_LINKEDIN:
    case ContentFormat.SOCIAL_INSTAGRAM:
    case ContentFormat.SOCIAL_FACEBOOK:
    case ContentFormat.SOCIAL_TIKTOK:
      text += `SOCIAL MEDIA POST (${content.socialPlatform})\n\n`;
      if (content.threadContent) {
        const thread = safeJsonParse<string[]>(content.threadContent, []);
        thread.forEach((tweet, index) => {
          text += `${index + 1}. ${tweet}\n\n`;
        });
      } else {
        text += `${content.socialContent || ""}\n\n`;
      }
      if (content.hashtags && content.hashtags.length > 0) {
        text += `Hashtags: ${content.hashtags.map((tag: string) => `#${tag}`).join(" ")}\n`;
      }
      break;

    case ContentFormat.VIDEO_YOUTUBE:
    case ContentFormat.VIDEO_SHORT:
      text += `VIDEO SCRIPT\n\n`;
      text += content.videoScript || "";
      if (content.videoStoryboard) {
        text += `\n\nSTORYBOARD:\n`;
        const storyboard = safeJsonParse<Array<{ time: string; scene: string; visuals: string; narration: string }>>(content.videoStoryboard, []);
        storyboard.forEach((scene) => {
          text += `${scene.time}: ${scene.scene}\n`;
          text += `  Visuals: ${scene.visuals}\n`;
          text += `  Narration: ${scene.narration}\n\n`;
        });
      }
      break;

    case ContentFormat.NEWSLETTER:
      text += `EMAIL NEWSLETTER\n\n`;
      text += `Subject: ${content.newsletterSubjectLine || ""}\n`;
      text += `Preheader: ${content.newsletterPreheader || ""}\n\n`;
      text += `Content:\n${content.newsletterPlainText || ""}\n`;
      break;

    case ContentFormat.INFOGRAPHIC:
      text += `INFOGRAPHIC DATA\n\n`;
      text += `Title: ${content.infographicTitle || ""}\n\n`;
      if (content.keyStatistics) {
        text += `Key Statistics:\n`;
        const stats = safeJsonParse<Array<{ label: string; value: string; context: string }>>(content.keyStatistics, []);
        stats.forEach((stat) => {
          text += `- ${stat.label}: ${stat.value} (${stat.context})\n`;
        });
      }
      break;

    default:
      text +=
        content.socialContent ||
        content.podcastScript ||
        content.videoScript ||
        "No content available";
  }

  return text;
}

/**
 * Generate HTML export
 */
function generateHtmlExport(content: any): string {
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(content.title)}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        h2 { color: #666; margin-top: 30px; }
        .meta { color: #999; font-size: 0.9em; margin-bottom: 20px; }
        .section { margin: 20px 0; }
        .qa-item { margin: 15px 0; padding: 15px; background: #f5f5f5; border-radius: 5px; }
        .hashtag { display: inline-block; background: #e0e0e0; padding: 3px 8px; margin: 2px; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>${escapeHtml(content.title)}</h1>
    <div class="meta">Format: ${escapeHtml(content.formatType)} | Created: ${new Date(content.createdAt).toLocaleString()}</div>
`;

  switch (content.formatType) {
    case ContentFormat.PODCAST:
      html += `
        <h2>Podcast Script</h2>
        <div class="section">
          <h3>Introduction</h3>
          <p>${escapeHtml(content.podcastIntro || "")}</p>
        </div>
        <div class="section">
          <h3>Main Content</h3>
          <p>${escapeHtml(content.podcastScript || "").replace(/\n/g, "<br>")}</p>
        </div>`;
      if (content.podcastQA) {
        html += `<div class="section"><h3>Q&A Segment</h3>`;
        const qa = safeJsonParse<Array<{ question: string; answer: string }>>(content.podcastQA, []);
        qa.forEach((item) => {
          html += `
            <div class="qa-item">
              <strong>Q:</strong> ${escapeHtml(item.question)}<br>
              <strong>A:</strong> ${escapeHtml(item.answer)}
            </div>`;
        });
        html += `</div>`;
      }
      html += `
        <div class="section">
          <h3>Outro</h3>
          <p>${escapeHtml(content.podcastOutro || "")}</p>
        </div>
        <div class="section">
          <h3>Show Notes</h3>
          <p>${escapeHtml(content.podcastShowNotes || "").replace(/\n/g, "<br>")}</p>
        </div>`;
      break;

    case ContentFormat.NEWSLETTER:
      html += `
        <h2>Email Newsletter</h2>
        <div class="section">
          <p><strong>Subject:</strong> ${escapeHtml(content.newsletterSubjectLine || "")}</p>
          <p><strong>Preheader:</strong> ${escapeHtml(content.newsletterPreheader || "")}</p>
        </div>
        <div class="section">
          <h3>HTML Content</h3>
          ${sanitizeArticleHtml(content.newsletterHtml || "")}
        </div>`;
      break;

    default:
      html += `<div class="section">${escapeHtml(content.socialContent || content.podcastScript || "No content available")}</div>`;
  }

  html += `
</body>
</html>`;

  return html;
}

export default router;
