import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mocks are available when vi.mock factory runs
const { mockSelect, mockInsert, mockUpdate, mockDelete, mockExecute } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockExecute: vi.fn(),
}));

vi.mock("../../../server/db", () => ({
  db: {
    select: () => mockSelect(),
    insert: () => mockInsert(),
    update: () => mockUpdate(),
    delete: () => mockDelete(),
    execute: mockExecute,
  },
}));

vi.mock("@shared/schema", () => ({
  studies: {
    id: "id",
    title: "title",
    abstract: "abstract",
    authors: "authors",
    publishDate: "publish_date",
    publishYear: "publish_year",
    journal: "journal",
    category: "category",
    country: "country",
    slug: "slug",
    doi: "doi",
    peerReviewed: "peer_reviewed",
    imageUrl: "image_url",
    videoUrl: "video_url",
    audioUrl: "audio_url",
    viewCount: "view_count",
    journalPublishDate: "journal_publish_date",
    createdAt: "created_at",
  },
  seoMetadata: {
    studyId: "study_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ type: "eq", field, value })),
  or: vi.fn((...args: any[]) => ({ type: "or", conditions: args })),
  and: vi.fn((...args: any[]) => ({ type: "and", conditions: args })),
  sql: vi.fn(() => "sql"),
  desc: vi.fn((col) => ({ type: "desc", col })),
  asc: vi.fn((col) => ({ type: "asc", col })),
  count: vi.fn(() => "count"),
  isNull: vi.fn((col) => ({ type: "isNull", col })),
  isNotNull: vi.fn((col) => ({ type: "isNotNull", col })),
  inArray: vi.fn(),
}));

import { StudyService } from "../../../server/services/study-service";

describe("StudyService", () => {
  let service: StudyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StudyService();
  });

  describe("getStudyById", () => {
    it("should return a study when found", async () => {
      const mockStudy = {
        id: 1,
        title: "Hydrogen Water Study",
        imageUrl: "https://example.com/img.jpg",
      };

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockStudy]),
          }),
        }),
      });

      const result = await service.getStudyById(1);
      expect(result).toEqual(mockStudy);
    });

    it("should return undefined when study not found", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.getStudyById(999);
      expect(result).toBeUndefined();
    });

    it("should assign placeholder image when study has no imageUrl", async () => {
      const mockStudy = {
        id: 1,
        title: "Hydrogen Water Benefits",
        imageUrl: null,
      };

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockStudy]),
          }),
        }),
      });

      const result = await service.getStudyById(1);
      expect(result?.imageUrl).toContain("placehold.co");
      expect(result?.imageUrl).toContain("Hydrogen");
    });
  });

  describe("getStudyBySlug", () => {
    it("should return study by slug", async () => {
      const mockStudy = { id: 1, slug: "hydrogen-water-study" };

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockStudy]),
          }),
        }),
      });

      const result = await service.getStudyBySlug("hydrogen-water-study");
      expect(result).toEqual(mockStudy);
    });

    it("should return undefined for non-existent slug", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.getStudyBySlug("non-existent");
      expect(result).toBeUndefined();
    });
  });

  describe("getLatestStudies", () => {
    it("should return latest studies ordered by id desc", async () => {
      const mockStudies = [
        { id: 3, title: "Study 3" },
        { id: 2, title: "Study 2" },
      ];

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockStudies),
          }),
        }),
      });

      const result = await service.getLatestStudies(2);
      expect(result).toEqual(mockStudies);
      expect(result).toHaveLength(2);
    });

    it("should default to 20 studies", async () => {
      const limitFn = vi.fn().mockResolvedValue([]);
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: limitFn,
          }),
        }),
      });

      await service.getLatestStudies();
      expect(limitFn).toHaveBeenCalledWith(20);
    });
  });

  describe("createStudy", () => {
    it("should insert and return the new study", async () => {
      const newStudy = { title: "New Study", abstract: "Abstract text" };
      const inserted = { id: 1, ...newStudy, createdAt: new Date() };

      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([inserted]),
        }),
      });

      const result = await service.createStudy(newStudy as any);
      expect(result.id).toBe(1);
      expect(result.title).toBe("New Study");
    });
  });

  describe("updateStudy", () => {
    it("should update and return the updated study", async () => {
      const updated = { id: 1, title: "Updated Title" };

      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const result = await service.updateStudy(1, { title: "Updated Title" } as any);
      expect(result.title).toBe("Updated Title");
    });
  });

  describe("deleteStudy", () => {
    it("should delete a study by id", async () => {
      const whereFn = vi.fn().mockResolvedValue(undefined);
      mockDelete.mockReturnValue({
        where: whereFn,
      });

      await service.deleteStudy(1);
      expect(whereFn).toHaveBeenCalled();
    });
  });

  describe("getStudyByIdentifier", () => {
    it("should normalize and search by DOI", async () => {
      const mockStudy = { id: 1, doi: "10.1234/test" };

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockStudy]),
          }),
        }),
      });

      const result = await service.getStudyByIdentifier("  10.1234/TEST  ");
      expect(result).toEqual(mockStudy);
    });
  });
});
