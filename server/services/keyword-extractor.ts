/**
 * Keyword extraction utilities for processing study data
 * This helps extract meaningful keywords from study titles, topics, and other fields
 */

/**
 * Extract keywords from study data
 * @param studyData Object containing study fields
 * @returns Array of unique keywords
 */
export function extractKeywords(studyData: Record<string, any>): string[] {
  // Extract explicit keywords if available
  let keywords: string[] = [];

  if (studyData.Keywords) {
    // Split by commas, semicolons, or vertical bars
    keywords = String(studyData.Keywords)
      .split(/[,;|]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  // If no keywords provided, extract from other fields
  if (keywords.length === 0) {
    // Generate keywords from other fields
    const keywordSources = [
      studyData.Title,
      studyData["Primary Topic"],
      studyData["Secondary Topic"],
      studyData.Model,
      studyData.HealthConditions,
      studyData.BodySystems,
    ];

    // Extract meaningful words from each source
    keywordSources.forEach((source) => {
      if (source) {
        const sourceText = String(source);
        // Extract words with 4+ characters that are likely meaningful
        const words = sourceText
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .map((w) => w.toLowerCase().replace(/[^\w]/g, "")); // Clean up
        keywords.push(...words);
      }
    });
  }

  // Deduplicate keywords
  keywords = [...new Set(keywords)].filter((k) => k && k.length > 1);

  // Limit to reasonable number
  return keywords.slice(0, 20);
}

/**
 * Common stopwords to filter out
 */
const stopwords = new Set([
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "also",
  "and",
  "any",
  "are",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "can",
  "cannot",
  "could",
  "did",
  "does",
  "doing",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "has",
  "have",
  "having",
  "here",
  "how",
  "into",
  "itself",
  "just",
  "more",
  "most",
  "not",
  "now",
  "off",
  "once",
  "only",
  "other",
  "ought",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "same",
  "should",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "thus",
  "too",
  "under",
  "until",
  "very",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "with",
  "would",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
]);

/**
 * Extract keywords from text while filtering out common stopwords
 * @param text Text to extract keywords from
 * @returns Array of keywords
 */
export function extractKeywordsFromText(text: string): string[] {
  if (!text) return [];

  // Split text into words
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^\w]/g, ""))
    .filter(
      (word) => word.length > 3 && !stopwords.has(word) && !/^\d+$/.test(word), // Filter out numbers
    );

  // Count word frequencies
  const wordCounts = new Map<string, number>();
  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  }

  // Sort by frequency
  return [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map((entry) => entry[0])
    .slice(0, 15);
}
