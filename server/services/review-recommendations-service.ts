import { db } from "../db";
import {
  studies,
  reviewRecommendations,
  studyQualityScores,
} from "../../shared/schema";
import { eq, and, or, sql, desc, inArray, ne, like, gt, lt } from "drizzle-orm";
import { ai } from "./ai-provider";

interface StudyRecommendations {
  priority: "high" | "medium" | "low";
  suggestedActions: string[];
  keyFindings: string[];
  potentialIssues: string[];
  strengthsIdentified: string[];
  relatedStudyIds: number[];
  suggestedCategories: string[];
  suggestedTags: string[];
  suggestedBlogTopics: string[];
  healthConditions: string[];
  bodySystems: string[];
  deliveryMethods: string[];
  studyTypeClassification: string;
  ageGroups: string[];
  geographicRelevance: string[];
  mechanismsOfAction: string[];
  researchTeamId?: string;
  studyGroupId?: string;
  isFollowUp: boolean;
  isReplication: boolean;
  contradictsStudyIds: number[];
  confidenceScore: number;
}

export class ReviewRecommendationsService {
  /**
   * Generate comprehensive review recommendations for a study
   */
  async generateRecommendations(
    studyId: number,
  ): Promise<StudyRecommendations> {
    try {
      // Fetch study data and quality scores
      const [study] = await db
        .select()
        .from(studies)
        .where(eq(studies.id, studyId))
        .limit(1);

      if (!study) {
        throw new Error(`Study with ID ${studyId} not found`);
      }

      const [qualityScores] = await db
        .select()
        .from(studyQualityScores)
        .where(eq(studyQualityScores.studyId, studyId))
        .limit(1);

      // Generate recommendations based on study analysis
      const priority = this.determinePriority(qualityScores);
      const suggestedActions = await this.generateSuggestedActions(
        study,
        qualityScores,
      );
      const keyFindings = await this.extractKeyFindings(study);
      const potentialIssues = await this.identifyPotentialIssues(
        study,
        qualityScores,
      );
      const strengthsIdentified = await this.identifyStrengths(
        study,
        qualityScores,
      );

      // Find related studies
      const relatedStudyIds = await this.findRelatedStudies(study);
      const contradictsStudyIds = await this.findContradictingStudies(study);

      // Auto-categorization
      const categories = await this.suggestCategories(study);
      const tags = await this.suggestTags(study);
      const blogTopics = await this.suggestBlogTopics(study);

      // Extract study characteristics
      const healthConditions = await this.extractHealthConditions(study);
      const bodySystems = await this.extractBodySystems(study);
      const deliveryMethods = await this.extractDeliveryMethods(study);
      const studyTypeClassification = await this.classifyStudyType(study);
      const ageGroups = await this.extractAgeGroups(study);
      const geographicRelevance = await this.extractGeographicRelevance(study);
      const mechanismsOfAction = await this.extractMechanismsOfAction(study);

      // Determine grouping
      const researchTeamId = this.generateResearchTeamId(study.authors);
      const studyGroupId = await this.determineStudyGroup(study);
      const isFollowUp = await this.isFollowUpStudy(study);
      const isReplication = await this.isReplicationStudy(study);

      // Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(
        keyFindings,
        potentialIssues,
        strengthsIdentified,
      );

      const recommendations: StudyRecommendations = {
        priority,
        suggestedActions,
        keyFindings,
        potentialIssues,
        strengthsIdentified,
        relatedStudyIds,
        suggestedCategories: categories,
        suggestedTags: tags,
        suggestedBlogTopics: blogTopics,
        healthConditions,
        bodySystems,
        deliveryMethods,
        studyTypeClassification,
        ageGroups,
        geographicRelevance,
        mechanismsOfAction,
        researchTeamId,
        studyGroupId,
        isFollowUp,
        isReplication,
        contradictsStudyIds,
        confidenceScore,
      };

      // Save recommendations to database
      await this.saveRecommendations(studyId, recommendations);

      return recommendations;
    } catch (error) {
      console.error("Error generating recommendations:", error);
      throw error;
    }
  }

  /**
   * Determine priority based on quality scores
   */
  private determinePriority(qualityScores: any): "high" | "medium" | "low" {
    if (!qualityScores) return "medium";

    const overallScore = qualityScores.overallScore || 0;
    const redFlagCount = qualityScores.redFlagCount || 0;

    if (overallScore >= 80 && redFlagCount === 0) return "high";
    if (overallScore >= 60 && redFlagCount <= 1) return "medium";
    return "low";
  }

  /**
   * Generate suggested actions based on study analysis
   */
  private async generateSuggestedActions(
    study: any,
    qualityScores: any,
  ): Promise<string[]> {
    const actions: string[] = [];

    if (qualityScores?.overallScore >= 80) {
      actions.push("Fast-track for publication");
      actions.push("Feature in newsletter");
      actions.push("Create detailed blog post");
    } else if (qualityScores?.overallScore >= 60) {
      actions.push("Standard review process");
      actions.push("Consider for blog mention");
    } else {
      actions.push("Detailed review required");
      actions.push("Verify data accuracy");
      actions.push("Check for duplicates");
    }

    if (qualityScores?.redFlagCount > 0) {
      actions.push("Review red flags carefully");
      actions.push("Consider requesting additional information");
    }

    if (study.studyType === "human") {
      actions.push("Prioritize for clinical relevance");
    }

    return actions;
  }

  /**
   * Extract key findings using AI
   */
  private async extractKeyFindings(study: any): Promise<string[]> {
    if (ai.getProviderStatus().primary === "none") {
      return this.extractKeyFindingsBasic(study);
    }

    try {
      const systemPrompt = "You are a research analyst. Extract key findings from studies and return JSON.";

      const userPrompt = `
        Extract 3-5 key findings from this research study:

        Title: ${study.title}
        Abstract: ${study.abstract}
        Results: ${study.results || "Not provided"}
        Conclusion: ${study.conclusion || "Not provided"}

        Return a JSON object with a "findings" array of concise, clear key findings.
        Focus on the most important and actionable results.
      `;

      const result = await ai.generateJSON(systemPrompt, userPrompt, {
        temperature: 0.3,
        maxTokens: 500,
      });

      return result.findings || this.extractKeyFindingsBasic(study);
    } catch (error) {
      console.error("Error extracting key findings with AI:", error);
      return this.extractKeyFindingsBasic(study);
    }
  }

  /**
   * Basic key findings extraction without AI
   */
  private extractKeyFindingsBasic(study: any): string[] {
    const findings: string[] = [];
    const text = (
      study.conclusion ||
      study.results ||
      study.abstract ||
      ""
    ).toLowerCase();

    if (text.includes("significant")) {
      findings.push("Statistically significant results observed");
    }
    if (text.includes("improved") || text.includes("improvement")) {
      findings.push("Improvements noted in treatment group");
    }
    if (text.includes("reduced") || text.includes("reduction")) {
      findings.push("Reduction in targeted symptoms/markers");
    }
    if (text.includes("safe") || text.includes("well-tolerated")) {
      findings.push("Treatment found to be safe and well-tolerated");
    }
    if (text.includes("effective")) {
      findings.push("Treatment demonstrated effectiveness");
    }

    return findings.slice(0, 5);
  }

  /**
   * Identify potential issues in the study
   */
  private async identifyPotentialIssues(
    study: any,
    qualityScores: any,
  ): Promise<string[]> {
    const issues: string[] = [];

    if (qualityScores?.redFlags && qualityScores.redFlags.length > 0) {
      issues.push(...qualityScores.redFlags);
    }

    if (study.sampleSize && study.sampleSize < 50) {
      issues.push("Limited sample size may affect generalizability");
    }

    if (!study.methods || study.methods.length < 100) {
      issues.push("Limited methodology description");
    }

    if (!study.peerReviewed) {
      issues.push("Not peer-reviewed");
    }

    return issues;
  }

  /**
   * Identify study strengths
   */
  private async identifyStrengths(
    study: any,
    qualityScores: any,
  ): Promise<string[]> {
    const strengths: string[] = [];

    if (qualityScores?.methodologyScore >= 80) {
      strengths.push("Strong methodology");
    }

    if (qualityScores?.impactScore >= 80) {
      strengths.push("Published in high-impact journal");
    }

    if (study.studyType === "human") {
      strengths.push("Human clinical trial");
    }

    if (study.sampleSize && study.sampleSize >= 100) {
      strengths.push("Large sample size");
    }

    const text = (study.abstract + " " + study.methods).toLowerCase();

    if (text.includes("randomized controlled")) {
      strengths.push("Randomized controlled trial design");
    }

    if (text.includes("double-blind")) {
      strengths.push("Double-blind methodology");
    }

    if (text.includes("placebo-controlled")) {
      strengths.push("Placebo-controlled");
    }

    return strengths;
  }

  /**
   * Find related studies based on various criteria
   */
  private async findRelatedStudies(study: any): Promise<number[]> {
    try {
      // Find studies with similar keywords or topics
      const keywords = study.title
        .toLowerCase()
        .split(" ")
        .filter((word: string) => word.length > 4)
        .slice(0, 5);

      const relatedStudies = await db
        .select({ id: studies.id })
        .from(studies)
        .where(
          and(
            ne(studies.id, study.id),
            or(
              ...keywords.map((keyword: any) => like(studies.title, `%${keyword}%`)),
            ),
          ),
        )
        .limit(10);

      return relatedStudies.map((s) => s.id);
    } catch (error) {
      console.error("Error finding related studies:", error);
      return [];
    }
  }

  /**
   * Find studies that may contradict this one
   */
  private async findContradictingStudies(study: any): Promise<number[]> {
    // This would require more sophisticated analysis
    // For now, return empty array
    return [];
  }

  /**
   * Suggest categories for the study
   */
  private async suggestCategories(study: any): Promise<string[]> {
    const categories: string[] = [];
    const text = (study.title + " " + study.abstract).toLowerCase();

    // Health condition categories
    if (text.includes("cardiovascular") || text.includes("heart")) {
      categories.push("Cardiovascular Health");
    }
    if (text.includes("cancer") || text.includes("tumor")) {
      categories.push("Cancer Research");
    }
    if (text.includes("diabetes") || text.includes("glucose")) {
      categories.push("Metabolic Disorders");
    }
    if (text.includes("inflammation") || text.includes("inflammatory")) {
      categories.push("Inflammation");
    }
    if (text.includes("cognitive") || text.includes("brain")) {
      categories.push("Neurological");
    }
    if (text.includes("exercise") || text.includes("athletic")) {
      categories.push("Sports Medicine");
    }

    return categories;
  }

  /**
   * Suggest tags for the study
   */
  private async suggestTags(study: any): Promise<string[]> {
    const tags: string[] = [];
    const text = (study.title + " " + study.abstract).toLowerCase();

    // Delivery method tags
    if (text.includes("inhalation") || text.includes("inhaled")) {
      tags.push("inhalation");
    }
    if (text.includes("water") || text.includes("drinking")) {
      tags.push("hydrogen-water");
    }
    if (text.includes("injection") || text.includes("iv")) {
      tags.push("injection");
    }

    // Study type tags
    if (text.includes("pilot")) {
      tags.push("pilot-study");
    }
    if (text.includes("meta-analysis")) {
      tags.push("meta-analysis");
    }
    if (text.includes("review")) {
      tags.push("review");
    }

    return tags;
  }

  /**
   * Suggest blog topics based on the study
   */
  private async suggestBlogTopics(study: any): Promise<string[]> {
    const topics: string[] = [];

    topics.push(`Breaking Down: ${study.title}`);
    topics.push(`What This Means for Hydrogen Therapy Users`);

    if (study.studyType === "human") {
      topics.push(`Real-World Applications of This Research`);
    }

    const text = study.abstract.toLowerCase();
    if (text.includes("breakthrough") || text.includes("novel")) {
      topics.push(`New Discovery in Hydrogen Research`);
    }

    return topics;
  }

  /**
   * Extract health conditions mentioned in the study
   */
  private async extractHealthConditions(study: any): Promise<string[]> {
    const conditions: string[] = [];
    const text = (study.title + " " + study.abstract).toLowerCase();

    const conditionKeywords = [
      "diabetes",
      "cancer",
      "alzheimer",
      "parkinson",
      "arthritis",
      "hypertension",
      "depression",
      "anxiety",
      "asthma",
      "copd",
      "heart disease",
      "stroke",
      "kidney disease",
      "liver disease",
    ];

    for (const condition of conditionKeywords) {
      if (text.includes(condition)) {
        conditions.push(condition);
      }
    }

    return conditions;
  }

  /**
   * Extract body systems affected
   */
  private async extractBodySystems(study: any): Promise<string[]> {
    const systems: string[] = [];
    const text = (study.title + " " + study.abstract).toLowerCase();

    const systemKeywords = {
      cardiovascular: ["heart", "cardiac", "vascular", "blood pressure"],
      respiratory: ["lung", "respiratory", "breathing", "pulmonary"],
      nervous: ["brain", "neural", "cognitive", "neurological"],
      digestive: ["digestive", "gastro", "intestinal", "stomach"],
      immune: ["immune", "immunity", "inflammatory"],
      musculoskeletal: ["muscle", "bone", "joint", "skeletal"],
    };

    for (const [system, keywords] of Object.entries(systemKeywords)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        systems.push(system);
      }
    }

    return systems;
  }

  /**
   * Extract hydrogen delivery methods
   */
  private async extractDeliveryMethods(study: any): Promise<string[]> {
    const methods: string[] = [];
    const text = (
      study.title +
      " " +
      study.abstract +
      " " +
      (study.methods || "")
    ).toLowerCase();

    if (text.includes("inhalation") || text.includes("inhaled")) {
      methods.push("inhalation");
    }
    if (text.includes("hydrogen-rich water") || text.includes("hrw")) {
      methods.push("hydrogen-rich water");
    }
    if (text.includes("injection") || text.includes("intravenous")) {
      methods.push("injection");
    }
    if (text.includes("saline")) {
      methods.push("hydrogen-rich saline");
    }
    if (text.includes("bath") || text.includes("topical")) {
      methods.push("topical/bath");
    }

    return methods;
  }

  /**
   * Classify the study type
   */
  private async classifyStudyType(study: any): Promise<string> {
    const text = (
      study.title +
      " " +
      study.abstract +
      " " +
      (study.methods || "")
    ).toLowerCase();

    if (text.includes("randomized controlled trial") || text.includes("rct")) {
      return "Randomized Controlled Trial";
    }
    if (text.includes("meta-analysis")) {
      return "Meta-Analysis";
    }
    if (text.includes("systematic review")) {
      return "Systematic Review";
    }
    if (text.includes("cohort")) {
      return "Cohort Study";
    }
    if (text.includes("case-control")) {
      return "Case-Control Study";
    }
    if (text.includes("cross-sectional")) {
      return "Cross-Sectional Study";
    }
    if (text.includes("case report")) {
      return "Case Report";
    }
    if (text.includes("observational")) {
      return "Observational Study";
    }

    return "Research Study";
  }

  /**
   * Extract age groups studied
   */
  private async extractAgeGroups(study: any): Promise<string[]> {
    const groups: string[] = [];
    const text = (study.abstract + " " + (study.methods || "")).toLowerCase();

    if (text.includes("pediatric") || text.includes("children")) {
      groups.push("pediatric");
    }
    if (text.includes("adolescent") || text.includes("teenager")) {
      groups.push("adolescent");
    }
    if (text.includes("adult")) {
      groups.push("adult");
    }
    if (text.includes("elderly") || text.includes("geriatric")) {
      groups.push("elderly");
    }

    return groups;
  }

  /**
   * Extract geographic relevance
   */
  private async extractGeographicRelevance(study: any): Promise<string[]> {
    // For simplicity, return general regions
    // Could be enhanced with actual location extraction
    return ["global"];
  }

  /**
   * Extract mechanisms of action
   */
  private async extractMechanismsOfAction(study: any): Promise<string[]> {
    const mechanisms: string[] = [];
    const text = (study.abstract + " " + (study.results || "")).toLowerCase();

    if (text.includes("antioxidant")) {
      mechanisms.push("antioxidant");
    }
    if (text.includes("anti-inflammatory")) {
      mechanisms.push("anti-inflammatory");
    }
    if (text.includes("apoptosis")) {
      mechanisms.push("apoptosis regulation");
    }
    if (text.includes("mitochondrial")) {
      mechanisms.push("mitochondrial function");
    }
    if (text.includes("oxidative stress")) {
      mechanisms.push("oxidative stress reduction");
    }

    return mechanisms;
  }

  /**
   * Generate research team ID based on authors
   */
  private generateResearchTeamId(authors: string): string {
    // Simple hash of first few authors
    const firstAuthors = authors.split(",").slice(0, 3).join(",");
    return Buffer.from(firstAuthors).toString("base64").substring(0, 10);
  }

  /**
   * Determine study group for batch review
   */
  private async determineStudyGroup(study: any): Promise<string> {
    // Group by similar topics or conditions
    const mainTopic = study.category || "general";
    return `group_${mainTopic}_${new Date().toISOString().split("T")[0]}`;
  }

  /**
   * Check if this is a follow-up study
   */
  private async isFollowUpStudy(study: any): Promise<boolean> {
    const text = (study.title + " " + study.abstract).toLowerCase();
    return (
      text.includes("follow-up") ||
      text.includes("follow up") ||
      text.includes("long-term") ||
      text.includes("longitudinal")
    );
  }

  /**
   * Check if this is a replication study
   */
  private async isReplicationStudy(study: any): Promise<boolean> {
    const text = (study.title + " " + study.abstract).toLowerCase();
    return (
      text.includes("replication") ||
      text.includes("replicate") ||
      text.includes("confirm") ||
      text.includes("validation")
    );
  }

  /**
   * Calculate confidence score for recommendations
   */
  private calculateConfidenceScore(
    keyFindings: string[],
    potentialIssues: string[],
    strengthsIdentified: string[],
  ): number {
    let score = 50; // Base score

    score += keyFindings.length * 5;
    score += strengthsIdentified.length * 8;
    score -= potentialIssues.length * 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Save recommendations to database
   */
  private async saveRecommendations(
    studyId: number,
    recommendations: StudyRecommendations,
  ) {
    await db
      .insert(reviewRecommendations)
      .values({
        studyId,
        priority: recommendations.priority,
        suggestedActions: recommendations.suggestedActions,
        keyFindings: recommendations.keyFindings,
        potentialIssues: recommendations.potentialIssues,
        strengthsIdentified: recommendations.strengthsIdentified,
        relatedStudyIds: recommendations.relatedStudyIds,
        suggestedCategories: recommendations.suggestedCategories,
        suggestedTags: recommendations.suggestedTags,
        suggestedBlogTopics: recommendations.suggestedBlogTopics,
        healthConditions: recommendations.healthConditions,
        bodySystems: recommendations.bodySystems,
        deliveryMethods: recommendations.deliveryMethods,
        studyTypeClassification: recommendations.studyTypeClassification,
        ageGroups: recommendations.ageGroups,
        geographicRelevance: recommendations.geographicRelevance,
        mechanismsOfAction: recommendations.mechanismsOfAction,
        researchTeamId: recommendations.researchTeamId,
        studyGroupId: recommendations.studyGroupId,
        isFollowUp: recommendations.isFollowUp,
        isReplication: recommendations.isReplication,
        contradictsStudyIds: recommendations.contradictsStudyIds,
        confidenceScore: recommendations.confidenceScore,
        analysisVersion: "1.0.0",
      })
      .onConflictDoUpdate({
        target: reviewRecommendations.studyId,
        set: {
          priority: recommendations.priority,
          suggestedActions: recommendations.suggestedActions,
          keyFindings: recommendations.keyFindings,
          potentialIssues: recommendations.potentialIssues,
          strengthsIdentified: recommendations.strengthsIdentified,
          relatedStudyIds: recommendations.relatedStudyIds,
          suggestedCategories: recommendations.suggestedCategories,
          suggestedTags: recommendations.suggestedTags,
          suggestedBlogTopics: recommendations.suggestedBlogTopics,
          healthConditions: recommendations.healthConditions,
          bodySystems: recommendations.bodySystems,
          deliveryMethods: recommendations.deliveryMethods,
          studyTypeClassification: recommendations.studyTypeClassification,
          ageGroups: recommendations.ageGroups,
          geographicRelevance: recommendations.geographicRelevance,
          mechanismsOfAction: recommendations.mechanismsOfAction,
          researchTeamId: recommendations.researchTeamId,
          studyGroupId: recommendations.studyGroupId,
          isFollowUp: recommendations.isFollowUp,
          isReplication: recommendations.isReplication,
          contradictsStudyIds: recommendations.contradictsStudyIds,
          confidenceScore: recommendations.confidenceScore,
          analysisVersion: "1.0.0",
          lastUpdated: sql`NOW()`,
        },
      });
  }
}

// Export singleton instance
export const reviewRecommendationsService = new ReviewRecommendationsService();
