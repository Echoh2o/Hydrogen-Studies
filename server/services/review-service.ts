import { db } from "../db";
import { studyReviewQueue, studies, type Study } from "@shared/schema";
import { and, eq, desc } from "drizzle-orm";

/** Default queue page size. Tuned to comfortably fit on one admin screen. */
const DEFAULT_QUEUE_LIMIT = 50;
/** Hard upper bound — prevents a single request from scraping the whole table. */
const MAX_QUEUE_LIMIT = 200;

export class ReviewService {
  /**
   * Returns a page of review-queue items. Always bounded — never returns the
   * whole table. Callers pass `limit`/`offset` (both clamped); results are
   * ordered newest-first.
   */
  async getQueue(filters: {
    status?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const conditions = [];
    if (filters.status) {
      conditions.push(eq(studyReviewQueue.status, filters.status));
    }
    if (filters.userId) {
      conditions.push(eq(studyReviewQueue.savedByUserId, filters.userId));
    }

    const limit = Math.min(
      MAX_QUEUE_LIMIT,
      Math.max(1, filters.limit ?? DEFAULT_QUEUE_LIMIT),
    );
    const offset = Math.max(0, filters.offset ?? 0);

    const base = db.select().from(studyReviewQueue);
    const filtered = conditions.length > 0 ? base.where(and(...conditions)) : base;
    return filtered
      .orderBy(desc(studyReviewQueue.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getQueueItemById(id: number) {
    const result = await db
      .select()
      .from(studyReviewQueue)
      .where(eq(studyReviewQueue.id, id))
      .limit(1);
    return result[0];
  }

  async addToQueue(item: any) {
    const [result] = await db.insert(studyReviewQueue).values(item).returning();
    return result;
  }

  async updateStatus(id: number, status: string, userId: string, notes?: string) {
    const [result] = await db
      .update(studyReviewQueue)
      .set({
        status,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewNotes: notes ? notes : undefined
      })
      .where(eq(studyReviewQueue.id, id))
      .returning();
    return result;
  }

  async deleteFromQueue(id: number) {
    await db.delete(studyReviewQueue).where(eq(studyReviewQueue.id, id));
  }
}

export const reviewService = new ReviewService();
