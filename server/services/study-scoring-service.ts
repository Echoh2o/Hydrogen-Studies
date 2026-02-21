import { db } from "../db";
import {
  studies,
  studyQualityScores,
  reviewRecommendations,
} from "../../shared/schema";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { ai } from "./ai-provider";

interface ScoringResult {
  methodologyScore: number;
  impactScore: number;
  relevanceScore: number;
  overallScore: number;
  scoreBreakdown: any;
  redFlags: string[];
}

interface StudyData {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate?: string;
  journalPublishDate?: string;
  methods?: string | null;
  results?: string | null;
  conclusion?: string | null;
  sampleSize?: number | null;
  studyType?: string | null;
  citationCount?: number | null;
  fundingSources?: string | null;
  conflictOfInterest?: string | null;
  peerReviewed?: boolean;
}

export class StudyScoringService {
  // Methodology scoring weights
  private readonly METHODOLOGY_WEIGHTS = {
    sampleSize: 0.25,
    studyDesign: 0.25,
    blinding: 0.15,
    controlGroup: 0.15,
    statisticalRigor: 0.2,
  };

  // Impact scoring weights
  private readonly IMPACT_WEIGHTS = {
    journalImpact: 0.3,
    citations: 0.25,
    authorReputation: 0.2,
    institution: 0.15,
    fundingQuality: 0.1,
  };

  // Relevance scoring weights
  private readonly RELEVANCE_WEIGHTS = {
    hydrogenFocus: 0.3,
    humanStudy: 0.25,
    clinicalApplicability: 0.2,
    recency: 0.15,
    practicalImplications: 0.1,
  };

  // Red flag thresholds
  private readonly RED_FLAGS = {
    smallSampleSize: 30,
    predatoryJournalKeywords: ["predatory", "questionable", "pay-to-publish"],
    missingDataKeywords: [
      "data not shown",
      "results not provided",
      "unpublished",
    ],
    conflictKeywords: ["conflict of interest", "funded by", "employee of"],
    retractionKeywords: ["retracted", "withdrawn", "corrected"],
  };

  /**
   * Score a single study
   */
  async scoreStudy(studyId: number): Promise<ScoringResult> {
    try {
      // Fetch study data
      const studyData = await this.fetchStudyData(studyId);
      if (!studyData) {
        throw new Error(`Study with ID ${studyId} not found`);
      }

      // Calculate individual scores
      const methodologyScore = await this.calculateMethodologyScore(studyData);
      const impactScore = await this.calculateImpactScore(studyData);
      const relevanceScore = await this.calculateRelevanceScore(studyData);

      // Detect red flags
      const redFlags = await this.detectRedFlags(studyData);

      // Calculate overall score
      const baseScore =
        methodologyScore * 0.4 + impactScore * 0.3 + relevanceScore * 0.3;

      // Apply red flag penalties (5 points per red flag, max 30 points penalty)
      const redFlagPenalty = Math.min(redFlags.length * 5, 30);
      const overallScore = Math.max(0, Math.round(baseScore - redFlagPenalty));

      // Create detailed breakdown
      const scoreBreakdown = {
        methodology: {
          total: methodologyScore,
          components: await this.getMethodologyBreakdown(studyData),
        },
        impact: {
          total: impactScore,
          components: await this.getImpactBreakdown(studyData),
        },
        relevance: {
          total: relevanceScore,
          components: await this.getRelevanceBreakdown(studyData),
        },
        penalties: {
          redFlagCount: redFlags.length,
          penaltyApplied: redFlagPenalty,
        },
      };

      // Save scores to database
      await this.saveScores(studyId, {
        methodologyScore,
        impactScore,
        relevanceScore,
        overallScore,
        scoreBreakdown,
        redFlags,
      });

      return {
        methodologyScore,
        impactScore,
        relevanceScore,
        overallScore,
        scoreBreakdown,
        redFlags,
      };
    } catch (error) {
      console.error("Error scoring study:", error);
      throw error;
    }
  }

  /**
   * Batch score multiple studies
   */
  async batchScoreStudies(
    studyIds: number[],
  ): Promise<Map<number, ScoringResult>> {
    const results = new Map<number, ScoringResult>();

    // Process in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < studyIds.length; i += batchSize) {
      const batch = studyIds.slice(i, i + batchSize);
      const batchPromises = batch.map((id) => this.scoreStudy(id));
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          results.set(batch[index], result.value);
        } else {
          console.error(
            `Failed to score study ${batch[index]}:`,
            result.reason,
          );
        }
      });
    }

    return results;
  }

  /**
   * Calculate methodology score
   */
  private async calculateMethodologyScore(study: StudyData): Promise<number> {
    const scores = {
      sampleSize: this.scoreSampleSize(study.sampleSize),
      studyDesign: await this.scoreStudyDesign(study),
      blinding: await this.scoreBlinding(study),
      controlGroup: await this.scoreControlGroup(study),
      statisticalRigor: await this.scoreStatisticalRigor(study),
    };

    const weightedScore =
      scores.sampleSize * this.METHODOLOGY_WEIGHTS.sampleSize +
      scores.studyDesign * this.METHODOLOGY_WEIGHTS.studyDesign +
      scores.blinding * this.METHODOLOGY_WEIGHTS.blinding +
      scores.controlGroup * this.METHODOLOGY_WEIGHTS.controlGroup +
      scores.statisticalRigor * this.METHODOLOGY_WEIGHTS.statisticalRigor;

    return Math.round(weightedScore);
  }

  /**
   * Calculate impact score
   */
  private async calculateImpactScore(study: StudyData): Promise<number> {
    const scores = {
      journalImpact: await this.scoreJournalImpact(study.journal),
      citations: this.scoreCitations(study.citationCount),
      authorReputation: await this.scoreAuthorReputation(study.authors),
      institution: await this.scoreInstitution(study),
      fundingQuality: await this.scoreFundingQuality(study.fundingSources),
    };

    const weightedScore =
      scores.journalImpact * this.IMPACT_WEIGHTS.journalImpact +
      scores.citations * this.IMPACT_WEIGHTS.citations +
      scores.authorReputation * this.IMPACT_WEIGHTS.authorReputation +
      scores.institution * this.IMPACT_WEIGHTS.institution +
      scores.fundingQuality * this.IMPACT_WEIGHTS.fundingQuality;

    return Math.round(weightedScore);
  }

  /**
   * Calculate relevance score
   */
  private async calculateRelevanceScore(study: StudyData): Promise<number> {
    const scores = {
      hydrogenFocus: await this.scoreHydrogenFocus(study),
      humanStudy: this.scoreHumanStudy(study.studyType),
      clinicalApplicability: await this.scoreClinicalApplicability(study),
      recency: this.scoreRecency(study.journalPublishDate || study.publishDate),
      practicalImplications: await this.scorePracticalImplications(study),
    };

    const weightedScore =
      scores.hydrogenFocus * this.RELEVANCE_WEIGHTS.hydrogenFocus +
      scores.humanStudy * this.RELEVANCE_WEIGHTS.humanStudy +
      scores.clinicalApplicability *
        this.RELEVANCE_WEIGHTS.clinicalApplicability +
      scores.recency * this.RELEVANCE_WEIGHTS.recency +
      scores.practicalImplications *
        this.RELEVANCE_WEIGHTS.practicalImplications;

    return Math.round(weightedScore);
  }

  /**
   * Detect red flags in the study
   */
  private async detectRedFlags(study: StudyData): Promise<string[]> {
    const redFlags: string[] = [];
    const fullText = this.getFullText(study);

    // Check sample size
    if (study.sampleSize && study.sampleSize < this.RED_FLAGS.smallSampleSize) {
      redFlags.push(`Small sample size (n=${study.sampleSize})`);
    }

    // Check for predatory journal indicators
    const journalLower = study.journal.toLowerCase();
    if (
      this.RED_FLAGS.predatoryJournalKeywords.some((keyword) =>
        journalLower.includes(keyword),
      )
    ) {
      redFlags.push("Possible predatory journal");
    }

    // Check for missing data
    if (
      this.RED_FLAGS.missingDataKeywords.some((keyword) =>
        fullText.toLowerCase().includes(keyword),
      )
    ) {
      redFlags.push("Missing or unpublished data");
    }

    // Check for conflicts of interest
    if (
      study.conflictOfInterest &&
      this.RED_FLAGS.conflictKeywords.some((keyword) =>
        study.conflictOfInterest!.toLowerCase().includes(keyword),
      )
    ) {
      redFlags.push("Potential conflict of interest");
    }

    // Check for retraction indicators
    if (
      this.RED_FLAGS.retractionKeywords.some((keyword) =>
        fullText.toLowerCase().includes(keyword),
      )
    ) {
      redFlags.push("Possible retraction or correction");
    }

    // Use AI to detect additional red flags
    const aiRedFlags = await this.detectAIRedFlags(study);
    redFlags.push(...aiRedFlags);

    return Array.from(new Set(redFlags)); // Remove duplicates
  }

  /**
   * Use AI to detect additional red flags
   */
  private async detectAIRedFlags(study: StudyData): Promise<string[]> {
    if (ai.getProviderStatus().primary === "none") {
      return [];
    }

    try {
      const systemPrompt = "You are a research quality analyst. Analyze studies for red flags and return JSON.";

      const userPrompt = `
        Analyze this research study for potential red flags or quality concerns:

        Title: ${study.title}
        Journal: ${study.journal}
        Abstract: ${study.abstract}
        Methods: ${study.methods || "Not provided"}

        Identify any of these specific red flags:
        1. Statistical manipulation or p-hacking
        2. Selective reporting of outcomes
        3. Inadequate control groups
        4. Unclear methodology
        5. Overgeneralized conclusions
        6. Missing ethics approval
        7. Inconsistent data

        Return a JSON object with a "redFlags" array of identified red flags (empty array if none).
        Be conservative and only flag clear issues.
      `;

      const result = await ai.generateJSON(systemPrompt, userPrompt, {
        temperature: 0.3,
        maxTokens: 500,
      });

      return result.redFlags || [];
    } catch (error) {
      console.error("Error detecting AI red flags:", error);
      return [];
    }
  }

  // Scoring helper methods

  private scoreSampleSize(sampleSize: number | null | undefined): number {
    if (!sampleSize) return 50;
    if (sampleSize >= 1000) return 100;
    if (sampleSize >= 500) return 90;
    if (sampleSize >= 200) return 80;
    if (sampleSize >= 100) return 70;
    if (sampleSize >= 50) return 60;
    if (sampleSize >= 30) return 50;
    return 30;
  }

  private async scoreStudyDesign(study: StudyData): Promise<number> {
    const text = this.getFullText(study).toLowerCase();

    if (text.includes("randomized controlled trial") || text.includes("rct"))
      return 100;
    if (text.includes("randomized") && text.includes("controlled")) return 95;
    if (text.includes("double-blind")) return 90;
    if (text.includes("single-blind")) return 80;
    if (text.includes("prospective")) return 75;
    if (text.includes("cohort")) return 70;
    if (text.includes("case-control")) return 65;
    if (text.includes("cross-sectional")) return 60;
    if (text.includes("observational")) return 55;
    if (text.includes("case report") || text.includes("case series")) return 40;

    return 50;
  }

  private async scoreBlinding(study: StudyData): Promise<number> {
    const text = this.getFullText(study).toLowerCase();

    if (text.includes("triple-blind")) return 100;
    if (text.includes("double-blind")) return 90;
    if (text.includes("single-blind")) return 70;
    if (text.includes("open-label")) return 40;

    return 50;
  }

  private async scoreControlGroup(study: StudyData): Promise<number> {
    const text = this.getFullText(study).toLowerCase();

    if (text.includes("placebo-controlled")) return 100;
    if (text.includes("active control")) return 85;
    if (text.includes("sham control")) return 80;
    if (text.includes("control group")) return 70;
    if (text.includes("compared to") || text.includes("versus")) return 60;

    return 40;
  }

  private async scoreStatisticalRigor(study: StudyData): Promise<number> {
    const text = this.getFullText(study).toLowerCase();
    let score = 50;

    if (text.includes("p-value") || text.includes("p <") || text.includes("p="))
      score += 15;
    if (text.includes("confidence interval") || text.includes("95% ci"))
      score += 15;
    if (text.includes("power analysis")) score += 10;
    if (text.includes("effect size")) score += 10;
    if (
      text.includes("bonferroni") ||
      text.includes("multiple testing correction")
    )
      score += 10;
    if (text.includes("intention-to-treat")) score += 10;

    return Math.min(100, score);
  }

  private async scoreJournalImpact(journal: string): Promise<number> {
    const topJournals = [
      "nature",
      "science",
      "cell",
      "lancet",
      "new england journal",
      "jama",
      "bmj",
      "annals of internal medicine",
    ];

    const journalLower = journal.toLowerCase();

    if (topJournals.some((j) => journalLower.includes(j))) return 100;
    if (
      journalLower.includes("international") ||
      journalLower.includes("american")
    )
      return 70;
    if (journalLower.includes("journal")) return 60;

    return 50;
  }

  private scoreCitations(citations: number | null | undefined): number {
    if (!citations) return 30;
    if (citations >= 100) return 100;
    if (citations >= 50) return 85;
    if (citations >= 20) return 70;
    if (citations >= 10) return 60;
    if (citations >= 5) return 50;

    return 40;
  }

  private async scoreAuthorReputation(authors: string): Promise<number> {
    // Simple heuristic based on number of authors and institutions
    const authorCount = authors.split(",").length;

    if (authorCount >= 10) return 80;
    if (authorCount >= 5) return 70;
    if (authorCount >= 3) return 60;

    return 50;
  }

  private async scoreInstitution(study: StudyData): Promise<number> {
    const text = this.getFullText(study).toLowerCase();
    const prestigiousInstitutions = [
      "harvard",
      "stanford",
      "mit",
      "oxford",
      "cambridge",
      "yale",
      "johns hopkins",
      "mayo clinic",
      "cleveland clinic",
    ];

    if (prestigiousInstitutions.some((inst) => text.includes(inst))) return 90;
    if (text.includes("university") || text.includes("institute")) return 70;

    return 50;
  }

  private async scoreFundingQuality(
    funding: string | null | undefined,
  ): Promise<number> {
    if (!funding) return 50;

    const fundingLower = funding.toLowerCase();

    if (fundingLower.includes("nih") || fundingLower.includes("nsf"))
      return 100;
    if (
      fundingLower.includes("government") ||
      fundingLower.includes("national")
    )
      return 85;
    if (fundingLower.includes("foundation") || fundingLower.includes("grant"))
      return 70;
    if (
      fundingLower.includes("industry") ||
      fundingLower.includes("pharmaceutical")
    )
      return 50;

    return 60;
  }

  private async scoreHydrogenFocus(study: StudyData): Promise<number> {
    const text = this.getFullText(study).toLowerCase();
    const hydrogenMentions = (text.match(/hydrogen/g) || []).length;
    const h2Mentions = (text.match(/\bh2\b/g) || []).length;
    const totalMentions = hydrogenMentions + h2Mentions;

    if (totalMentions >= 20) return 100;
    if (totalMentions >= 15) return 90;
    if (totalMentions >= 10) return 80;
    if (totalMentions >= 5) return 70;
    if (totalMentions >= 3) return 60;

    return 50;
  }

  private scoreHumanStudy(studyType: string | null | undefined): number {
    if (!studyType) return 50;

    const type = studyType.toLowerCase();

    if (type.includes("human") || type.includes("clinical")) return 100;
    if (
      type.includes("animal") ||
      type.includes("mouse") ||
      type.includes("rat")
    )
      return 60;
    if (type.includes("vitro") || type.includes("cell")) return 40;

    return 50;
  }

  private async scoreClinicalApplicability(study: StudyData): Promise<number> {
    const text = this.getFullText(study).toLowerCase();
    let score = 50;

    if (text.includes("clinical trial")) score += 20;
    if (text.includes("patient") || text.includes("treatment")) score += 15;
    if (text.includes("therapeutic") || text.includes("therapy")) score += 15;
    if (text.includes("practical") || text.includes("application")) score += 10;

    return Math.min(100, score);
  }

  private scoreRecency(publishDate: string | undefined): number {
    if (!publishDate) return 50;

    const date = new Date(publishDate);
    const now = new Date();
    const yearsOld =
      (now.getTime() - date.getTime()) / (365 * 24 * 60 * 60 * 1000);

    if (yearsOld <= 1) return 100;
    if (yearsOld <= 2) return 90;
    if (yearsOld <= 3) return 80;
    if (yearsOld <= 5) return 70;
    if (yearsOld <= 10) return 50;

    return 30;
  }

  private async scorePracticalImplications(study: StudyData): Promise<number> {
    const text = this.getFullText(study).toLowerCase();
    let score = 50;

    if (text.includes("practical")) score += 20;
    if (text.includes("clinical practice")) score += 20;
    if (text.includes("recommendation")) score += 15;
    if (text.includes("guideline")) score += 15;
    if (text.includes("implementation")) score += 10;

    return Math.min(100, score);
  }

  // Helper methods

  private async fetchStudyData(studyId: number): Promise<StudyData | null> {
    const [study] = await db
      .select()
      .from(studies)
      .where(eq(studies.id, studyId))
      .limit(1);

    return study as StudyData | null;
  }

  private getFullText(study: StudyData): string {
    return [
      study.title,
      study.abstract,
      study.methods,
      study.results,
      study.conclusion,
    ]
      .filter(Boolean)
      .join(" ");
  }

  private async getMethodologyBreakdown(study: StudyData) {
    return {
      sampleSize: this.scoreSampleSize(study.sampleSize),
      studyDesign: await this.scoreStudyDesign(study),
      blinding: await this.scoreBlinding(study),
      controlGroup: await this.scoreControlGroup(study),
      statisticalRigor: await this.scoreStatisticalRigor(study),
    };
  }

  private async getImpactBreakdown(study: StudyData) {
    return {
      journalImpact: await this.scoreJournalImpact(study.journal),
      citations: this.scoreCitations(study.citationCount),
      authorReputation: await this.scoreAuthorReputation(study.authors),
      institution: await this.scoreInstitution(study),
      fundingQuality: await this.scoreFundingQuality(study.fundingSources),
    };
  }

  private async getRelevanceBreakdown(study: StudyData) {
    return {
      hydrogenFocus: await this.scoreHydrogenFocus(study),
      humanStudy: this.scoreHumanStudy(study.studyType),
      clinicalApplicability: await this.scoreClinicalApplicability(study),
      recency: this.scoreRecency(study.journalPublishDate || study.publishDate),
      practicalImplications: await this.scorePracticalImplications(study),
    };
  }

  private async saveScores(studyId: number, scores: ScoringResult) {
    const breakdown = await this.getDetailedBreakdown(studyId, scores);

    await db
      .insert(studyQualityScores)
      .values({
        studyId,
        methodologyScore: scores.methodologyScore,
        impactScore: scores.impactScore,
        relevanceScore: scores.relevanceScore,
        overallScore: scores.overallScore,
        scoreBreakdown: JSON.stringify(scores.scoreBreakdown),
        redFlags: scores.redFlags,
        redFlagCount: scores.redFlags.length,
        ...breakdown,
      })
      .onConflictDoUpdate({
        target: studyQualityScores.studyId,
        set: {
          methodologyScore: scores.methodologyScore,
          impactScore: scores.impactScore,
          relevanceScore: scores.relevanceScore,
          overallScore: scores.overallScore,
          scoreBreakdown: JSON.stringify(scores.scoreBreakdown),
          redFlags: scores.redFlags,
          redFlagCount: scores.redFlags.length,
          ...breakdown,
          lastUpdated: sql`NOW()`,
        },
      });
  }

  private async getDetailedBreakdown(studyId: number, scores: ScoringResult) {
    const study = await this.fetchStudyData(studyId);
    if (!study) return {};

    return {
      sampleSizeScore: this.scoreSampleSize(study.sampleSize),
      studyDesignScore: await this.scoreStudyDesign(study),
      blindingScore: await this.scoreBlinding(study),
      controlGroupScore: await this.scoreControlGroup(study),
      statisticalRigorScore: await this.scoreStatisticalRigor(study),
      journalImpactScore: await this.scoreJournalImpact(study.journal),
      citationScore: this.scoreCitations(study.citationCount),
      authorReputationScore: await this.scoreAuthorReputation(study.authors),
      institutionScore: await this.scoreInstitution(study),
      fundingQualityScore: await this.scoreFundingQuality(study.fundingSources),
      hydrogenFocusScore: await this.scoreHydrogenFocus(study),
      humanStudyScore: this.scoreHumanStudy(study.studyType),
      clinicalApplicabilityScore: await this.scoreClinicalApplicability(study),
      recencyScore: this.scoreRecency(
        study.journalPublishDate || study.publishDate,
      ),
      practicalImplicationsScore: await this.scorePracticalImplications(study),
    };
  }
}

// Export singleton instance
export const studyScoringService = new StudyScoringService();
