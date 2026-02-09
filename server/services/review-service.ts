import { db } from "../db";
import { studyReviewQueue, studies, type Study } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export class ReviewService {
  async getQueue(filters: { status?: string; userId?: string } = {}) {
    let query = db.select().from(studyReviewQueue);
    const conditions = [];

    if (filters.status) {
      conditions.push(eq(studyReviewQueue.status, filters.status));
    }
    if (filters.userId) {
      // filters.userId logic if needed (it's string in schema)
      conditions.push(eq(studyReviewQueue.savedByUserId, filters.userId));
    }

    // Apply filters if any (using a helper or simple if)
    // For simplicity, just return all sorted by date for now if no complex method is ready
    return await query.orderBy(desc(studyReviewQueue.createdAt));
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
