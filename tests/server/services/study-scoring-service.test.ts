import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../../../server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("../../../shared/schema", () => ({
  studies: {},
  studyQualityScores: { studyId: "study_id" },
  reviewRecommendations: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  sql: vi.fn(),
  desc: vi.fn(),
}));

vi.mock("../../../server/services/ai-provider", () => ({
  ai: {
    getProviderStatus: vi.fn().mockReturnValue({ primary: "none" }),
    generateJSON: vi.fn(),
  },
}));

import { StudyScoringService } from "../../../server/services/study-scoring-service";

describe("StudyScoringService", () => {
  let service: StudyScoringService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StudyScoringService();
  });

  // Access private methods via any cast for unit testing scoring logic
  const callPrivate = (service: any, method: string, ...args: any[]) =>
    service[method](...args);

  describe("scoreSampleSize", () => {
    it("should return 50 for null sample size", () => {
      expect(callPrivate(service, "scoreSampleSize", null)).toBe(50);
    });

    it("should return 50 for undefined sample size", () => {
      expect(callPrivate(service, "scoreSampleSize", undefined)).toBe(50);
    });

    it("should return 100 for 1000+ samples", () => {
      expect(callPrivate(service, "scoreSampleSize", 1000)).toBe(100);
      expect(callPrivate(service, "scoreSampleSize", 5000)).toBe(100);
    });

    it("should return 90 for 500-999 samples", () => {
      expect(callPrivate(service, "scoreSampleSize", 500)).toBe(90);
    });

    it("should return 80 for 200-499 samples", () => {
      expect(callPrivate(service, "scoreSampleSize", 200)).toBe(80);
    });

    it("should return 70 for 100-199 samples", () => {
      expect(callPrivate(service, "scoreSampleSize", 100)).toBe(70);
    });

    it("should return 30 for very small samples", () => {
      expect(callPrivate(service, "scoreSampleSize", 10)).toBe(30);
    });
  });

  describe("scoreCitations", () => {
    it("should return 30 for no citations", () => {
      expect(callPrivate(service, "scoreCitations", null)).toBe(30);
    });

    it("should return 100 for 100+ citations", () => {
      expect(callPrivate(service, "scoreCitations", 100)).toBe(100);
    });

    it("should return 85 for 50-99 citations", () => {
      expect(callPrivate(service, "scoreCitations", 50)).toBe(85);
    });

    it("should return 40 for very few citations", () => {
      expect(callPrivate(service, "scoreCitations", 2)).toBe(40);
    });
  });

  describe("scoreHumanStudy", () => {
    it("should return 50 for null study type", () => {
      expect(callPrivate(service, "scoreHumanStudy", null)).toBe(50);
    });

    it("should return 100 for human studies", () => {
      expect(callPrivate(service, "scoreHumanStudy", "human clinical trial")).toBe(100);
    });

    it("should return 100 for clinical studies", () => {
      expect(callPrivate(service, "scoreHumanStudy", "clinical trial")).toBe(100);
    });

    it("should return 60 for animal studies", () => {
      expect(callPrivate(service, "scoreHumanStudy", "animal model")).toBe(60);
    });

    it("should return 60 for mouse studies", () => {
      expect(callPrivate(service, "scoreHumanStudy", "mouse model")).toBe(60);
    });

    it("should return 40 for in vitro studies", () => {
      expect(callPrivate(service, "scoreHumanStudy", "in vitro")).toBe(40);
    });

    it("should return 40 for cell studies", () => {
      expect(callPrivate(service, "scoreHumanStudy", "cell culture")).toBe(40);
    });
  });

  describe("scoreRecency", () => {
    it("should return 50 for undefined date", () => {
      expect(callPrivate(service, "scoreRecency", undefined)).toBe(50);
    });

    it("should return 100 for recent publications (< 1 year)", () => {
      const recent = new Date();
      recent.setMonth(recent.getMonth() - 6);
      expect(callPrivate(service, "scoreRecency", recent.toISOString())).toBe(100);
    });

    it("should return 30 for very old publications (> 10 years)", () => {
      const old = new Date();
      old.setFullYear(old.getFullYear() - 15);
      expect(callPrivate(service, "scoreRecency", old.toISOString())).toBe(30);
    });
  });

  describe("scoreStudyDesign", () => {
    it("should return 100 for RCT", async () => {
      const study = { title: "A randomized controlled trial of hydrogen", abstract: "", journal: "" };
      expect(await callPrivate(service, "scoreStudyDesign", study)).toBe(100);
    });

    it("should return 90 for double-blind", async () => {
      const study = { title: "Double-blind study", abstract: "", journal: "" };
      expect(await callPrivate(service, "scoreStudyDesign", study)).toBe(90);
    });

    it("should return 70 for cohort", async () => {
      const study = { title: "Cohort study of hydrogen", abstract: "", journal: "" };
      expect(await callPrivate(service, "scoreStudyDesign", study)).toBe(70);
    });

    it("should return 50 for unspecified design", async () => {
      const study = { title: "Some study", abstract: "about hydrogen", journal: "" };
      expect(await callPrivate(service, "scoreStudyDesign", study)).toBe(50);
    });
  });

  describe("scoreBlinding", () => {
    it("should return 100 for triple-blind", async () => {
      const study = { title: "Triple-blind trial", abstract: "", journal: "" };
      expect(await callPrivate(service, "scoreBlinding", study)).toBe(100);
    });

    it("should return 40 for open-label", async () => {
      const study = { title: "Open-label study", abstract: "", journal: "" };
      expect(await callPrivate(service, "scoreBlinding", study)).toBe(40);
    });
  });

  describe("scoreJournalImpact", () => {
    it("should return 100 for top journals", async () => {
      expect(await callPrivate(service, "scoreJournalImpact", "Nature Medicine")).toBe(100);
      expect(await callPrivate(service, "scoreJournalImpact", "The Lancet")).toBe(100);
      expect(await callPrivate(service, "scoreJournalImpact", "JAMA")).toBe(100);
    });

    it("should return 70 for international journals", async () => {
      expect(
        await callPrivate(service, "scoreJournalImpact", "International Journal of Hydrogen"),
      ).toBe(70);
    });

    it("should return 50 for unknown journals", async () => {
      expect(await callPrivate(service, "scoreJournalImpact", "Some Publisher")).toBe(50);
    });
  });

  describe("scoreAuthorReputation", () => {
    it("should return 80 for 10+ authors", async () => {
      const authors = Array(10).fill("Author").join(", ");
      expect(await callPrivate(service, "scoreAuthorReputation", authors)).toBe(80);
    });

    it("should return 50 for 1-2 authors", async () => {
      expect(await callPrivate(service, "scoreAuthorReputation", "Smith, Jones")).toBe(50);
    });
  });

  describe("scoreFundingQuality", () => {
    it("should return 50 for no funding info", async () => {
      expect(await callPrivate(service, "scoreFundingQuality", null)).toBe(50);
    });

    it("should return 100 for NIH funding", async () => {
      expect(await callPrivate(service, "scoreFundingQuality", "NIH Grant R01")).toBe(100);
    });

    it("should return 85 for government funding", async () => {
      expect(await callPrivate(service, "scoreFundingQuality", "Government research grant")).toBe(85);
    });
  });

  describe("getFullText", () => {
    it("should concatenate all text fields", () => {
      const study = {
        title: "Title",
        abstract: "Abstract",
        methods: "Methods",
        results: "Results",
        conclusion: "Conclusion",
        journal: "",
        authors: "",
        id: 1,
      };
      const result = callPrivate(service, "getFullText", study);
      expect(result).toContain("Title");
      expect(result).toContain("Abstract");
      expect(result).toContain("Methods");
    });

    it("should filter out null/undefined fields", () => {
      const study = {
        title: "Title",
        abstract: "Abstract",
        methods: null,
        results: undefined,
        journal: "",
        authors: "",
        id: 1,
      };
      const result = callPrivate(service, "getFullText", study);
      expect(result).toBe("Title Abstract");
    });
  });
});
