/**
 * User service to handle user-related operations
 */
import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  users,
  userPreferences,
  searchHistory,
  userStudyInteractions,
  userBlogInteractions,
  notifications,
  studies,
  blogArticles,
  type User,
  type UserPreferences,
  type SearchHistory,
  type InsertUser,
  type InsertUserPreferences,
  type InsertSearchHistory,
  type UserStudyInteraction,
  type InsertUserStudyInteraction,
  type UserBlogInteraction,
  type InsertUserBlogInteraction,
  type Notification,
  type InsertNotification,
  type Study,
  type BlogArticle
} from "@shared/schema";
import { comparePasswords, hashPassword } from "./auth";

/**
 * Get a user by ID
 */
export async function getUserById(id: number): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

/**
 * Get a user by email
 */
export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

/**
 * Create a new user
 */
export async function createUser(userData: InsertUser): Promise<User> {
  // Hash password if not already hashed
  if (!userData.password.startsWith('$2b$')) {
    userData.password = await hashPassword(userData.password);
  }
  
  const [user] = await db.insert(users).values(userData).returning();
  return user;
}

/**
 * Update a user
 */
export async function updateUser(id: number, userData: Partial<InsertUser>): Promise<User> {
  // If password is being updated, hash it
  if (userData.password && !userData.password.startsWith('$2b$')) {
    userData.password = await hashPassword(userData.password);
  }
  
  const [user] = await db
    .update(users)
    .set({ ...userData, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  
  return user;
}

/**
 * Delete a user
 */
export async function deleteUser(id: number): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}

/**
 * Authenticate a user
 */
export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;
  
  const isPasswordValid = await comparePasswords(password, user.password);
  if (!isPasswordValid) return null;
  
  return user;
}

/**
 * Get user preferences
 */
export async function getUserPreferences(userId: number): Promise<UserPreferences | undefined> {
  const [preferences] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
  
  return preferences;
}

/**
 * Create user preferences
 */
export async function createUserPreferences(preferencesData: InsertUserPreferences): Promise<UserPreferences> {
  const [preferences] = await db
    .insert(userPreferences)
    .values(preferencesData)
    .returning();
  
  return preferences;
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  id: number,
  preferencesData: Partial<InsertUserPreferences>
): Promise<UserPreferences> {
  const [preferences] = await db
    .update(userPreferences)
    .set({ ...preferencesData, updatedAt: new Date() })
    .where(eq(userPreferences.id, id))
    .returning();
  
  return preferences;
}

/**
 * Add a search to history
 */
export async function addSearchHistory(searchData: InsertSearchHistory): Promise<SearchHistory> {
  const [search] = await db
    .insert(searchHistory)
    .values(searchData)
    .returning();
  
  return search;
}

/**
 * Get user search history
 */
export async function getUserSearchHistory(userId: number, limit: number = 10): Promise<SearchHistory[]> {
  return await db
    .select()
    .from(searchHistory)
    .where(eq(searchHistory.userId, userId))
    .orderBy(desc(searchHistory.searchDate))
    .limit(limit);
}

/**
 * Save a study for a user
 */
export async function saveStudy(userId: number, studyId: number): Promise<UserStudyInteraction> {
  // Check if interaction exists
  const [existingInteraction] = await db
    .select()
    .from(userStudyInteractions)
    .where(
      and(
        eq(userStudyInteractions.userId, userId),
        eq(userStudyInteractions.studyId, studyId)
      )
    );
  
  if (existingInteraction) {
    // Update existing interaction
    const [updatedInteraction] = await db
      .update(userStudyInteractions)
      .set({ 
        isSaved: true,
        lastViewed: new Date()
      })
      .where(
        and(
          eq(userStudyInteractions.userId, userId),
          eq(userStudyInteractions.studyId, studyId)
        )
      )
      .returning();
    
    return updatedInteraction;
  } else {
    // Create new interaction
    const [newInteraction] = await db
      .insert(userStudyInteractions)
      .values({
        userId,
        studyId,
        isSaved: true,
        viewCount: 1,
        lastViewed: new Date()
      })
      .returning();
    
    return newInteraction;
  }
}

/**
 * Unsave a study for a user
 */
export async function unsaveStudy(userId: number, studyId: number): Promise<void> {
  await db
    .update(userStudyInteractions)
    .set({ isSaved: false })
    .where(
      and(
        eq(userStudyInteractions.userId, userId),
        eq(userStudyInteractions.studyId, studyId)
      )
    );
}

/**
 * Record a study view
 */
export async function recordStudyView(userId: number, studyId: number): Promise<void> {
  // Check if interaction exists
  const [existingInteraction] = await db
    .select()
    .from(userStudyInteractions)
    .where(
      and(
        eq(userStudyInteractions.userId, userId),
        eq(userStudyInteractions.studyId, studyId)
      )
    );
  
  if (existingInteraction) {
    // Update existing interaction
    await db
      .update(userStudyInteractions)
      .set({ 
        viewCount: existingInteraction.viewCount + 1,
        lastViewed: new Date()
      })
      .where(
        and(
          eq(userStudyInteractions.userId, userId),
          eq(userStudyInteractions.studyId, studyId)
        )
      );
  } else {
    // Create new interaction
    await db
      .insert(userStudyInteractions)
      .values({
        userId,
        studyId,
        isSaved: false,
        viewCount: 1,
        lastViewed: new Date()
      });
  }
}

/**
 * Get saved studies for a user
 */
export async function getSavedStudies(userId: number): Promise<Study[]> {
  const result = await db
    .select({ study: studies })
    .from(userStudyInteractions)
    .innerJoin(studies, eq(userStudyInteractions.studyId, studies.id))
    .where(
      and(
        eq(userStudyInteractions.userId, userId),
        eq(userStudyInteractions.isSaved, true)
      )
    )
    .orderBy(desc(userStudyInteractions.lastViewed));
  
  return result.map(row => row.study);
}

/**
 * Get recently viewed studies for a user
 */
export async function getRecentlyViewedStudies(userId: number, limit: number = 10): Promise<Study[]> {
  const result = await db
    .select({ study: studies })
    .from(userStudyInteractions)
    .innerJoin(studies, eq(userStudyInteractions.studyId, studies.id))
    .where(eq(userStudyInteractions.userId, userId))
    .orderBy(desc(userStudyInteractions.lastViewed))
    .limit(limit);
  
  return result.map(row => row.study);
}

/**
 * Save a blog for a user
 */
export async function saveBlog(userId: number, blogId: number): Promise<UserBlogInteraction> {
  // Check if interaction exists
  const [existingInteraction] = await db
    .select()
    .from(userBlogInteractions)
    .where(
      and(
        eq(userBlogInteractions.userId, userId),
        eq(userBlogInteractions.blogId, blogId)
      )
    );
  
  if (existingInteraction) {
    // Update existing interaction
    const [updatedInteraction] = await db
      .update(userBlogInteractions)
      .set({ 
        isSaved: true,
        lastViewed: new Date()
      })
      .where(
        and(
          eq(userBlogInteractions.userId, userId),
          eq(userBlogInteractions.blogId, blogId)
        )
      )
      .returning();
    
    return updatedInteraction;
  } else {
    // Create new interaction
    const [newInteraction] = await db
      .insert(userBlogInteractions)
      .values({
        userId,
        blogId,
        isSaved: true,
        viewCount: 1,
        lastViewed: new Date()
      })
      .returning();
    
    return newInteraction;
  }
}

/**
 * Unsave a blog for a user
 */
export async function unsaveBlog(userId: number, blogId: number): Promise<void> {
  await db
    .update(userBlogInteractions)
    .set({ isSaved: false })
    .where(
      and(
        eq(userBlogInteractions.userId, userId),
        eq(userBlogInteractions.blogId, blogId)
      )
    );
}

/**
 * Record a blog view
 */
export async function recordBlogView(userId: number, blogId: number): Promise<void> {
  // Check if interaction exists
  const [existingInteraction] = await db
    .select()
    .from(userBlogInteractions)
    .where(
      and(
        eq(userBlogInteractions.userId, userId),
        eq(userBlogInteractions.blogId, blogId)
      )
    );
  
  if (existingInteraction) {
    // Update existing interaction
    await db
      .update(userBlogInteractions)
      .set({ 
        viewCount: existingInteraction.viewCount + 1,
        lastViewed: new Date()
      })
      .where(
        and(
          eq(userBlogInteractions.userId, userId),
          eq(userBlogInteractions.blogId, blogId)
        )
      );
  } else {
    // Create new interaction
    await db
      .insert(userBlogInteractions)
      .values({
        userId,
        blogId,
        isSaved: false,
        viewCount: 1,
        lastViewed: new Date()
      });
  }
  
  // Also update the blog view count
  await db
    .update(blogArticles)
    .set({ 
      viewCount: blogArticles.viewCount + 1 
    })
    .where(eq(blogArticles.id, blogId));
}

/**
 * Get saved blogs for a user
 */
export async function getSavedBlogs(userId: number): Promise<BlogArticle[]> {
  const result = await db
    .select({ blog: blogArticles })
    .from(userBlogInteractions)
    .innerJoin(blogArticles, eq(userBlogInteractions.blogId, blogArticles.id))
    .where(
      and(
        eq(userBlogInteractions.userId, userId),
        eq(userBlogInteractions.isSaved, true)
      )
    )
    .orderBy(desc(userBlogInteractions.lastViewed));
  
  return result.map(row => row.blog);
}

/**
 * Get recently viewed blogs for a user
 */
export async function getRecentlyViewedBlogs(userId: string, limit: number = 10): Promise<BlogArticle[]> {
  const result = await db
    .select({ blog: blogArticles })
    .from(userBlogInteractions)
    .innerJoin(blogArticles, eq(userBlogInteractions.blogId, blogArticles.id))
    .where(eq(userBlogInteractions.userId, userId))
    .orderBy(desc(userBlogInteractions.lastViewed))
    .limit(limit);
  
  return result.map(row => row.blog);
}

/**
 * Create a notification
 */
export async function createNotification(notificationData: InsertNotification): Promise<Notification> {
  const [notification] = await db
    .insert(notifications)
    .values(notificationData)
    .returning();
  
  return notification;
}

/**
 * Get user notifications
 */
export async function getUserNotifications(userId: string, unreadOnly: boolean = false): Promise<Notification[]> {
  let query = db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId));
  
  if (unreadOnly) {
    query = query.where(eq(notifications.isRead, false));
  }
  
  return await query.orderBy(desc(notifications.createdAt));
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(id: number): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, id));
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.userId, userId));
}