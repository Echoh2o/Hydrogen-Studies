import { db } from "../db";
import { studies } from "../../shared/schema";
import { eq, gte, lte, and, sql, or, like, desc, asc } from "drizzle-orm";
import memoizee from "memoizee";

interface TimelineData {
  year: number;
  count: number;
  categories: Record<string, number>;
  breakthroughs: Array<{
    id: number;
    title: string;
    impact: number;
  }>;
}

interface BodySystemData {
  system: string;
  count: number;
  studies: number[];
  benefits: string[];
  impactScore: number;
  conditions: string[];
}

interface StudyConnection {
  source: number;
  target: number;
  strength: number;
  type: string; // 'citation', 'author', 'topic'
}

interface ResearchEvolution {
  year: number;
  topics: string[];
  connections: Array<{
    from: string;
    to: string;
    weight: number;
  }>;
}

interface GeographicData {
  country: string;
  count: number;
  years: number[];
  topics: string[];
}

class ExplorerDataService {
  // Cache durations
  private readonly SHORT_CACHE = 5 * 60 * 1000; // 5 minutes
  private readonly LONG_CACHE = 60 * 60 * 1000; // 1 hour

  // Body systems mapping
  private readonly bodySystems = {
    cardiovascular: [
      "heart",
      "cardiac",
      "cardiovascular",
      "blood pressure",
      "hypertension",
      "atherosclerosis",
      "circulation",
    ],
    neurological: [
      "brain",
      "neural",
      "cognitive",
      "alzheimer",
      "parkinson",
      "neuroprotective",
      "memory",
      "stroke",
    ],
    digestive: [
      "gut",
      "intestine",
      "digestive",
      "bowel",
      "colitis",
      "microbiome",
      "gastric",
    ],
    respiratory: [
      "lung",
      "respiratory",
      "asthma",
      "copd",
      "breathing",
      "pulmonary",
    ],
    immune: [
      "immune",
      "inflammation",
      "cytokine",
      "antibody",
      "lymphocyte",
      "infection",
    ],
    musculoskeletal: [
      "muscle",
      "bone",
      "joint",
      "arthritis",
      "osteoporosis",
      "skeletal",
      "cartilage",
    ],
    metabolic: [
      "diabetes",
      "metabolism",
      "insulin",
      "glucose",
      "obesity",
      "metabolic syndrome",
    ],
    renal: ["kidney", "renal", "nephro", "dialysis", "urinary"],
    hepatic: ["liver", "hepatic", "cirrhosis", "fatty liver", "hepato"],
    dermatological: [
      "skin",
      "derma",
      "wound",
      "healing",
      "psoriasis",
      "eczema",
    ],
  };

  // Benefits mapping
  private readonly benefits = {
    "anti-inflammatory": [
      "inflammation",
      "inflammatory",
      "cytokine",
      "tnf",
      "interleukin",
    ],
    antioxidant: ["oxidative", "ros", "free radical", "antioxidant", "redox"],
    "anti-apoptotic": ["apoptosis", "cell death", "survival", "viability"],
    neuroprotective: ["neuroprotect", "brain damage", "neural protection"],
    cardioprotective: ["cardioprotect", "heart protection", "myocardial"],
    "anti-aging": ["aging", "senescence", "longevity", "telomere"],
  };

  // Get timeline data
  getTimelineData = memoizee(
    async (startYear = 2000, endYear = new Date().getFullYear()) => {
      try {
        const allStudies = await db
          .select({
            id: studies.id,
            title: studies.title,
            year: studies.publishYear,
            category: studies.category,
            citationCount: studies.citationCount,
            abstract: studies.abstract,
          })
          .from(studies)
          .where(
            and(
              gte(studies.publishYear, startYear),
              lte(studies.publishYear, endYear),
            ),
          );

        // Group by year
        const timelineMap = new Map<number, TimelineData>();

        for (let year = startYear; year <= endYear; year++) {
          timelineMap.set(year, {
            year,
            count: 0,
            categories: {},
            breakthroughs: [],
          });
        }

        allStudies.forEach((study) => {
          const year = study.year || new Date().getFullYear();
          const yearData = timelineMap.get(year);

          if (yearData) {
            yearData.count++;
            yearData.categories[study.category] =
              (yearData.categories[study.category] || 0) + 1;

            // Mark as breakthrough if high citation count
            if (study.citationCount && study.citationCount > 50) {
              yearData.breakthroughs.push({
                id: study.id,
                title: study.title,
                impact: study.citationCount,
              });
            }
          }
        });

        return Array.from(timelineMap.values());
      } catch (error) {
        console.error("Error getting timeline data:", error);
        return [];
      }
    },
    { maxAge: this.SHORT_CACHE },
  );

  // Get body systems data
  getBodySystemsData = memoizee(
    async () => {
      try {
        const allStudies = await db
          .select({
            id: studies.id,
            title: studies.title,
            abstract: studies.abstract,
            category: studies.category,
            results: studies.results,
          })
          .from(studies);

        const systemsData: BodySystemData[] = [];

        for (const [system, keywords] of Object.entries(this.bodySystems)) {
          const relevantStudies = allStudies.filter((study) => {
            const searchText =
              `${study.title} ${study.abstract} ${study.results || ""}`.toLowerCase();
            return keywords.some((keyword) =>
              searchText.includes(keyword.toLowerCase()),
            );
          });

          if (relevantStudies.length > 0) {
            // Identify benefits
            const systemBenefits = new Set<string>();
            relevantStudies.forEach((study) => {
              const searchText =
                `${study.abstract} ${study.results || ""}`.toLowerCase();
              for (const [benefit, benefitKeywords] of Object.entries(
                this.benefits,
              )) {
                if (
                  benefitKeywords.some((keyword) =>
                    searchText.includes(keyword),
                  )
                ) {
                  systemBenefits.add(benefit);
                }
              }
            });

            // Extract conditions
            const conditions = new Set<string>();
            relevantStudies.forEach((study) => {
              // Extract conditions from category and abstract
              if (study.category) {
                conditions.add(study.category);
              }
            });

            systemsData.push({
              system,
              count: relevantStudies.length,
              studies: relevantStudies.map((s) => s.id),
              benefits: Array.from(systemBenefits),
              impactScore: Math.min(100, relevantStudies.length * 2), // Simple impact score
              conditions: Array.from(conditions).slice(0, 5), // Top 5 conditions
            });
          }
        }

        return systemsData.sort((a, b) => b.count - a.count);
      } catch (error) {
        console.error("Error getting body systems data:", error);
        return [];
      }
    },
    { maxAge: this.LONG_CACHE },
  );

  // Get study connections
  getStudyConnections = memoizee(
    async (studyId?: number) => {
      try {
        const connections: StudyConnection[] = [];

        if (studyId) {
          // Get specific study
          const targetStudy = await db
            .select()
            .from(studies)
            .where(eq(studies.id, studyId))
            .limit(1);

          if (targetStudy.length === 0) return [];

          const study = targetStudy[0];

          // Find related studies by category
          const relatedByCategory = await db
            .select({ id: studies.id })
            .from(studies)
            .where(
              and(
                eq(studies.category, study.category),
                sql`${studies.id} != ${studyId}`,
              ),
            )
            .limit(10);

          relatedByCategory.forEach((related) => {
            connections.push({
              source: studyId,
              target: related.id,
              strength: 0.5,
              type: "topic",
            });
          });

          // Find related by similar keywords in title/abstract
          const keywords = study.title.split(" ").filter((w) => w.length > 4);
          if (keywords.length > 0) {
            const conditions = keywords.map((keyword) =>
              or(
                like(studies.title, `%${keyword}%`),
                like(studies.abstract, `%${keyword}%`),
              ),
            );

            const relatedByKeywords = await db
              .select({ id: studies.id })
              .from(studies)
              .where(and(or(...conditions), sql`${studies.id} != ${studyId}`))
              .limit(10);

            relatedByKeywords.forEach((related) => {
              connections.push({
                source: studyId,
                target: related.id,
                strength: 0.7,
                type: "topic",
              });
            });
          }
        } else {
          // Get general connections network (limited for performance)
          const topStudies = await db
            .select({
              id: studies.id,
              category: studies.category,
              citationCount: studies.citationCount,
            })
            .from(studies)
            .orderBy(desc(studies.citationCount))
            .limit(50);

          // Create connections between studies in same category
          const categoryGroups = new Map<string, number[]>();
          topStudies.forEach((study) => {
            if (!categoryGroups.has(study.category)) {
              categoryGroups.set(study.category, []);
            }
            categoryGroups.get(study.category)!.push(study.id);
          });

          categoryGroups.forEach((studyIds) => {
            for (let i = 0; i < studyIds.length - 1; i++) {
              for (let j = i + 1; j < Math.min(i + 3, studyIds.length); j++) {
                connections.push({
                  source: studyIds[i],
                  target: studyIds[j],
                  strength: 0.6,
                  type: "topic",
                });
              }
            }
          });
        }

        return connections;
      } catch (error) {
        console.error("Error getting study connections:", error);
        return [];
      }
    },
    { maxAge: this.SHORT_CACHE },
  );

  // Get research evolution data
  getResearchEvolution = memoizee(
    async (startYear = 2000) => {
      try {
        const allStudies = await db
          .select({
            year: studies.publishYear,
            category: studies.category,
            title: studies.title,
          })
          .from(studies)
          .where(gte(studies.publishYear, startYear))
          .orderBy(asc(studies.publishYear));

        // Track topic evolution by year
        const evolutionMap = new Map<number, ResearchEvolution>();
        const topicTransitions = new Map<string, Map<string, number>>();

        let previousYearTopics = new Set<string>();

        allStudies.forEach((study) => {
          const year = study.year || new Date().getFullYear();

          if (!evolutionMap.has(year)) {
            evolutionMap.set(year, {
              year,
              topics: [],
              connections: [],
            });
          }

          const yearData = evolutionMap.get(year)!;
          if (!yearData.topics.includes(study.category)) {
            yearData.topics.push(study.category);
          }

          // Track transitions
          if (previousYearTopics.has(study.category)) {
            // Topic continues from previous year
            const key = `${year - 1}-${study.category}`;
            if (!topicTransitions.has(key)) {
              topicTransitions.set(key, new Map());
            }
            topicTransitions
              .get(key)!
              .set(
                study.category,
                (topicTransitions.get(key)!.get(study.category) || 0) + 1,
              );
          }

          previousYearTopics.add(study.category);
        });

        // Build connections
        evolutionMap.forEach((yearData, year) => {
          const prevYear = evolutionMap.get(year - 1);
          if (prevYear) {
            prevYear.topics.forEach((fromTopic) => {
              yearData.topics.forEach((toTopic) => {
                const key = `${year - 1}-${fromTopic}`;
                const transitionMap = topicTransitions.get(key);
                if (transitionMap && transitionMap.has(toTopic)) {
                  yearData.connections.push({
                    from: fromTopic,
                    to: toTopic,
                    weight: transitionMap.get(toTopic)!,
                  });
                }
              });
            });
          }
        });

        return Array.from(evolutionMap.values());
      } catch (error) {
        console.error("Error getting research evolution:", error);
        return [];
      }
    },
    { maxAge: this.LONG_CACHE },
  );

  // Get geographic distribution
  getGeographicDistribution = memoizee(
    async () => {
      try {
        const allStudies = await db
          .select({
            country: studies.country,
            year: studies.publishYear,
            category: studies.category,
          })
          .from(studies)
          .where(
            sql`${studies.country} IS NOT NULL AND ${studies.country} != ''`,
          );

        const geoMap = new Map<string, GeographicData>();

        allStudies.forEach((study) => {
          if (!study.country) return;

          if (!geoMap.has(study.country)) {
            geoMap.set(study.country, {
              country: study.country,
              count: 0,
              years: [],
              topics: [],
            });
          }

          const countryData = geoMap.get(study.country)!;
          countryData.count++;

          if (study.year && !countryData.years.includes(study.year)) {
            countryData.years.push(study.year);
          }

          if (!countryData.topics.includes(study.category)) {
            countryData.topics.push(study.category);
          }
        });

        return Array.from(geoMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 20); // Top 20 countries
      } catch (error) {
        console.error("Error getting geographic distribution:", error);
        return [];
      }
    },
    { maxAge: this.LONG_CACHE },
  );

  // Get comparison data
  async getComparisonData(studyIds: number[]) {
    try {
      const selectedStudies = await db
        .select()
        .from(studies)
        .where(
          sql`${studies.id} IN (${sql.join(
            studyIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );

      return selectedStudies.map((study) => ({
        id: study.id,
        title: study.title,
        year: study.publishYear,
        category: study.category,
        deliveryMethod: (study as any).deliveryMethod,
        dosage: (study as any).dosage,
        duration: study.duration,
        sampleSize: study.sampleSize,
        outcome: study.outcome,
        methods: study.methodsShort || study.methods,
        results: study.resultsShort || study.results,
        conclusion: study.conclusionShort || study.conclusion,
        citationCount: study.citationCount,
        peerReviewed: study.peerReviewed,
      }));
    } catch (error) {
      console.error("Error getting comparison data:", error);
      return [];
    }
  }

  // Clear all caches
  clearCache() {
    this.getTimelineData.clear();
    this.getBodySystemsData.clear();
    this.getStudyConnections.clear();
    this.getResearchEvolution.clear();
    this.getGeographicDistribution.clear();
  }
}

export const explorerDataService = new ExplorerDataService();
