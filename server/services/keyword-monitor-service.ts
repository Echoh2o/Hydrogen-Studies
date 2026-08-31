import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { keywords, monitorSchedule, monitorResults } from "@shared/schema";
import { searchPubMedWithPagination } from "../routes/research-routes";
import { searchCrossRef } from "./crossref-api";
import { searchEuropePMC } from "./europepmc-api-fixed";
import { searchSemanticScholar } from "./semantic-scholar-api";
import { searchMedRxiv, searchBioRxiv } from "./preprint-api";
import { searchGoogleScholar } from "./google-scholar-api";

// Sources that we can search - Mapped to real API functions
const SEARCH_SOURCES = {
  pubmed: async (terms: string[]) => {
     // Join terms with OR for a broad search
     const query = terms.join(" OR ");
     // Fetch results (using page 1, limit 20)
     const items = await searchPubMedWithPagination(query, 0, 20);
     // Map to common format
     return items.map(item => ({
       title: item.title,
       abstract: item.abstract || "",
       authors: item.authors,
       journal: item.journal,
       publishDate: item.publicationDate,
       doi: item.doi || "",
       url: item.url,
       source: "pubmed",
       externalId: item.pmid
     }));
  },
  crossref: async (terms: string[]) => {
      const query = terms.join(" OR ");
      const data = await searchCrossRef(query, 1, 20);
      const items = data.items || [];
       // Map to common format
      return items.map((item: any) => {
        // Extract authors safely
        const authors = item.author ? item.author.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).join(", ") : "Unknown";
        return {
          title: item.title ? item.title[0] : "Untitled",
          abstract: item.abstract || "",
          authors: authors,
          journal: item["container-title"] ? item["container-title"][0] : "",
          publishDate: item.created ? item.created["date-time"] : new Date().toISOString(),
          doi: item.DOI,
          url: item.URL,
          source: "crossref",
          externalId: item.DOI
        }
      });
  },
  europepmc: async (terms: string[]) => {
    const query = terms.join(" OR ");
    const data = await searchEuropePMC(query, 1, 20);
    const items = data.results || [];
    // Map to common format
    return items.map(item => ({
        title: item.title,
        abstract: item.abstractText || "",
        authors: item.authorString,
        journal: item.journalTitle,
        publishDate: item.firstPublicationDate,
        doi: item.doi,
        url: `https://europepmc.org/article/MED/${item.pmid}`,
        source: "europepmc",
        externalId: item.id
    }));
  },
  // Semantic scholar is separate as it might need specific handling, adding for completeness if needed
   semanticscholar: async (terms: string[]) => {
      const query = terms.join(" OR ");
      const data = await searchSemanticScholar(query, 0, 20);
      const items = data.data || [];
       return items.map((item: any) => ({
        title: item.title,
        abstract: item.abstract || "",
        authors: item.authors ? item.authors.map((a: any) => a.name).join(", ") : "",
        journal: item.venue || "",
        publishDate: item.publicationDate,
        doi: item.externalIds ? item.externalIds.DOI : "",
        url: item.url,
        source: "semanticscholar",
        externalId: item.paperId
      }));
   },

  // === NEW SOURCES: Preprints & Google Scholar ===

  // medRxiv preprints (health sciences, not yet peer-reviewed)
  medrxiv: async (terms: string[]) => {
    const query = terms.join(" OR ");
    const data = await searchMedRxiv(query, 1, 20);
    return data.results.map(item => ({
      title: item.title,
      abstract: item.abstract,
      authors: item.authors,
      journal: item.journal,
      publishDate: item.publishDate,
      doi: item.doi,
      url: item.url,
      source: "medrxiv",
      externalId: item.externalId,
    }));
  },

  // bioRxiv preprints (biology, biochemistry)
  biorxiv: async (terms: string[]) => {
    const query = terms.join(" OR ");
    const data = await searchBioRxiv(query, 1, 20);
    return data.results.map(item => ({
      title: item.title,
      abstract: item.abstract,
      authors: item.authors,
      journal: item.journal,
      publishDate: item.publishDate,
      doi: item.doi,
      url: item.url,
      source: "biorxiv",
      externalId: item.externalId,
    }));
  },

  // Google Scholar (uses SerpAPI if SERPAPI_KEY is set, otherwise direct HTTP — rate limited)
  googlescholar: async (terms: string[]) => {
    const query = terms.join(" OR ");
    const data = await searchGoogleScholar(query, 1, 20);
    return data.results.map(item => ({
      title: item.title,
      abstract: item.abstract,
      authors: item.authors,
      journal: item.journal,
      publishDate: item.publishDate,
      doi: item.doi,
      url: item.url,
      source: "google_scholar",
      externalId: item.externalId,
    }));
  },
};

/**
 * Check if a scheduled search should run now
 */
export async function checkScheduledSearches() {
  try {
    // Get the current schedule
    const [schedule] = await db.select().from(monitorSchedule);

    if (!schedule || !schedule.enabled) {
      return { ran: false, message: "No active schedule" };
    }

    const now = new Date();

    // If we have a nextRun time, check if it's time to run
    // Using a 1-minute buffer to allow for slight timing differences
    if (schedule.nextRun && schedule.nextRun > now) {
      return { ran: false, message: "Not scheduled to run yet" };
    }

    // Get all active keywords
    const activeKeywords = await db
      .select()
      .from(keywords)
      .where(eq(keywords.isActive, true));

    if (activeKeywords.length === 0) {
      return { ran: false, message: "No active keywords to search" };
    }

    console.info(`Keyword monitor: searching ${activeKeywords.length} keywords across ${schedule.sources?.length || 'all'} sources`);

    // Run the searches
    const results = await runScheduledSearch(schedule.sources || [], activeKeywords);

    // Update the schedule with the last run time and calculate next run
    const nextRun = calculateNextRun(schedule);

    await db
      .update(monitorSchedule)
      .set({
        lastRun: now,
        nextRun,
        updatedAt: now,
      })
      .where(eq(monitorSchedule.id, schedule.id));

    return {
      ran: true,
      results,
      nextRun,
    };
  } catch (error) {
    console.error("Error checking scheduled searches:", error);
    return { ran: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Run a scheduled search across all configured sources
 */
async function runScheduledSearch(sources: string[], keywords: any[]) {
  const results = {
    total: 0,
    bySource: {} as Record<string, any>,
  };

  if (!sources || sources.length === 0) {
    // googlescholar is excluded from the default set: it now no-ops without a
    // SERPAPI_KEY (spoofed-UA scraping removed), so scheduling it by default
    // just wastes a pass. Callers can still opt in explicitly when a key is set.
    sources = ["pubmed", "crossref", "europepmc", "medrxiv", "biorxiv"];
  }

  // Create a list of all search terms
  const searchTerms = keywords.map((k) => k.term);

  // Run searches in parallel
  const searchPromises = sources.map(async (source) => {
    // Normalize source name
    const normalizedSource = source.toLowerCase().replace(/\s/g, '');
    
    if (SEARCH_SOURCES[normalizedSource as keyof typeof SEARCH_SOURCES]) {
      try {
        // Searching source
        const searchFn = SEARCH_SOURCES[normalizedSource as keyof typeof SEARCH_SOURCES];
        const sourceResults = await searchFn(searchTerms);
        
        results.total += sourceResults.length;
        results.bySource[source] = sourceResults.length;

        // Save the results to the database
        await saveSearchResults(sourceResults, source, keywords);

        return sourceResults;
      } catch (error) {
        console.error(`Error searching ${source}:`, error);
        results.bySource[source] = { error: error instanceof Error ? error.message : String(error) };
        return [];
      }
    } else {
      console.warn(`Keyword monitor: source "${source}" not supported`);
      results.bySource[source] = { error: "Source not supported" };
      return [];
    }
  });

  await Promise.all(searchPromises);

  return results;
}

/**
 * Calculate the next run time based on the schedule configuration
 */
function calculateNextRun(schedule: any) {
  const now = new Date();
  const nextRun = new Date(now);

  // Parse the scheduled time (HH:MM)
  const [hours, minutes] = schedule.time.split(":").map(Number);

  // Set the time for the next run
  nextRun.setHours(hours);
  nextRun.setMinutes(minutes);
  nextRun.setSeconds(0);
  nextRun.setMilliseconds(0);

  // If that time is already past for today, move to tomorrow
  // OR if we just ran it (within last minute), push to next cycle
  if (nextRun <= now) {
    // If frequency is 'hourly', add 1 hour instead of 1 day? 
    // Schema only has 'daily', 'weekly', 'monthly'.
    // Assuming 'daily' logic for simple case:
    nextRun.setDate(nextRun.getDate() + 1);
  }

  // Handle different frequencies
  switch (schedule.frequency) {
    case "daily":
      // Already set for tomorrow if needed
      break;

    case "weekly":
      // Make sure it's on one of the allowed days
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const todayIndex = now.getDay();
      const allowedDays = schedule.days || ["monday"];

      // Find the next allowed day
      let daysToAdd = 0;
      let foundDay = false;

      // Start checks from tomorrow (i=1)
      for (let i = 1; i <= 7; i++) {
        const checkDay = (todayIndex + i) % 7;
        // Logic might need refinement for 'weekly' but 'daily' + check is safer
        if (allowedDays.includes(dayNames[checkDay])) {
             // Basic logic: just add days
             // Ideally we align to the specific day
             const daysUntil = (checkDay + 7 - todayIndex) % 7 || 7;
             nextRun.setDate(now.getDate() + daysUntil);
             foundDay = true;
             break;
        }
      }
      break;

    case "monthly":
      // Set to first day of next month
      nextRun.setMonth(nextRun.getMonth() + 1);
      nextRun.setDate(1);
      break;
  }

  return nextRun;
}

/**
 * Save search results to the database
 */
async function saveSearchResults(results: any[], source: string, keywords: any[]) {
    // Deduplication Set for this batch
    const processedDOIs = new Set();
    
    // For each result, create a record in the database
    const insertPromises = results.map(async (result) => {
    try {
      // Basic validation
      if (!result.title) return null;
      
      // Deduplicate within this batch
      if (result.doi) {
          if (processedDOIs.has(result.doi)) return null;
          processedDOIs.add(result.doi);
      }

      // Cross-source/concurrent dedup is enforced by the partial unique index
      // monitor_results_doi_unique (on doi WHERE doi IS NOT NULL) via the
      // ON CONFLICT DO NOTHING below — no SELECT-then-INSERT race window.

      // Determine which keywords matched
      const matchedKeywords: string[] = [];
      const title = result.title.toLowerCase();
      const abstract = result.abstract ? result.abstract.toLowerCase() : "";

      keywords.forEach((keyword: any) => {
        const term = keyword.term.toLowerCase();
        if (title.includes(term) || abstract.includes(term)) {
          matchedKeywords.push(keyword.term);
        }
      });

      if (matchedKeywords.length === 0) {
        // If no specific keyword matched (e.g. from a broad OR search), tag as "General"
        matchedKeywords.push("General Discovery");
      }

      // Insert the result
      const [insertedResult] = await db
        .insert(monitorResults)
        .values({
          title: result.title,
          abstract: result.abstract,
          authors: result.authors,
          journal: result.journal,
          publishDate: result.publishDate,
          doi: result.doi,
          url: result.url,
          matchedKeywords,
          status: "pending", // Pending Review
          source,
          foundAt: new Date(),
        })
        // Concurrent sources may return the same paper; the partial unique
        // index on doi makes the duplicate insert a no-op (returning() is
        // empty, so insertedResult is undefined and gets filtered out).
        // The `where` predicate MUST mirror the index's predicate
        // (monitor_results_doi_unique ... WHERE doi IS NOT NULL) so Postgres
        // can infer the partial index — without it, `ON CONFLICT (doi)` matches
        // no constraint and every insert throws 42P10.
        .onConflictDoNothing({
          target: monitorResults.doi,
          where: sql`${monitorResults.doi} IS NOT NULL`,
        })
        .returning();

      return insertedResult;
    } catch (error) {
      console.error(`Error saving result:`, error);
      return null;
    }
  });

  const savedResults = await Promise.all(insertPromises);
  const count = savedResults.filter(Boolean).length;
  if (count > 0) console.info(`Keyword monitor: saved ${count} new studies from ${source}`);
  return savedResults.filter(Boolean);
}

/**
 * Manual trigger for the keyword monitor to run immediately
 */
export async function runKeywordMonitorNow() {
  try {
    // Get the current schedule
    const [schedule] = await db.select().from(monitorSchedule);

    if (!schedule) {
      return { success: false, message: "No schedule configuration found" };
    }

    // Get all active keywords
    const activeKeywords = await db
      .select()
      .from(keywords)
      .where(eq(keywords.isActive, true));

    if (activeKeywords.length === 0) {
      return { success: false, message: "No active keywords to search" };
    }
    
    console.info(`Keyword monitor: manual trigger for ${activeKeywords.length} keywords`);

    // Run the searches
    const results = await runScheduledSearch(schedule.sources || [], activeKeywords);

    // Update the last run time
    await db
      .update(monitorSchedule)
      .set({
        lastRun: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(monitorSchedule.id, schedule.id));

    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error("Error running keyword monitor:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
