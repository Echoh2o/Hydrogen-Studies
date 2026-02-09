import { db } from "../db";
import { categories, type Category, type InsertCategory } from "@shared/schema";
import { eq } from "drizzle-orm";

export class CategoryService {
  private categoryCache: Map<string, Category> = new Map();
  private categoryCacheLastUpdate: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  async getCategories(): Promise<Category[]> {
    const now = Date.now();
    if (this.categoryCache.size > 0 && now - this.categoryCacheLastUpdate < this.CACHE_TTL) {
      return Array.from(this.categoryCache.values());
    }

    const allCategories = await db.select().from(categories);

    this.categoryCache.clear();
    for (const category of allCategories) {
      this.categoryCache.set(category.name, category);
    }
    this.categoryCacheLastUpdate = now;

    return allCategories;
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    // Check cache first
    for (const category of this.categoryCache.values()) {
      if (category.id === id) {
        return category;
      }
    }

    const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    const category = result[0];

    if (category) {
      this.categoryCache.set(category.name, category);
    }

    return category;
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    if (this.categoryCache.has(name)) {
      return this.categoryCache.get(name);
    }

    const result = await db.select().from(categories).where(eq(categories.name, name)).limit(1);
    const category = result[0];

    if (category) {
      this.categoryCache.set(name, category);
    }

    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [insertedCategory] = await db
      .insert(categories)
      .values({ ...category, createdAt: new Date() })
      .returning();

    this.categoryCache.set(insertedCategory.name, insertedCategory);
    return insertedCategory;
  }
}

export const categoryService = new CategoryService();
