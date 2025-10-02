import { db } from "./db";
import { eq } from "drizzle-orm";
import { keywords, monitorSchedule, monitorResults } from "@shared/schema";
import axios from "axios";

// Sources that we can search
const SEARCH_SOURCES = {
  pubmed: searchPubMed,
  crossref: searchCrossRef,
  europepmc: searchEuropePMC,
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

    // Run the searches
    const results = await runScheduledSearch(schedule.sources, activeKeywords);

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
    return { ran: false, error: error.message };
  }
}

/**
 * Run a scheduled search across all configured sources
 */
async function runScheduledSearch(sources: string[], keywords: any[]) {
  const results = {
    total: 0,
    bySource: {},
  };

  if (!sources || sources.length === 0) {
    sources = ["pubmed", "crossref", "europepmc"]; // Default sources
  }

  // Create a list of all search terms
  const searchTerms = keywords.map((k) => k.term);

  // Run searches in parallel
  const searchPromises = sources.map(async (source) => {
    if (SEARCH_SOURCES[source]) {
      try {
        const sourceResults = await SEARCH_SOURCES[source](searchTerms);
        results.total += sourceResults.length;
        results.bySource[source] = sourceResults.length;

        // Save the results to the database
        await saveSearchResults(sourceResults, source, keywords);

        return sourceResults;
      } catch (error) {
        console.error(`Error searching ${source}:`, error);
        results.bySource[source] = { error: error.message };
        return [];
      }
    } else {
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
function calculateNextRun(schedule) {
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
  if (nextRun <= now) {
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

      for (let i = 1; i <= 7; i++) {
        const checkDay = (todayIndex + i) % 7;
        if (allowedDays.includes(dayNames[checkDay])) {
          daysToAdd = i;
          foundDay = true;
          break;
        }
      }

      if (foundDay) {
        nextRun.setDate(now.getDate() + daysToAdd);
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
async function saveSearchResults(results, source, keywords) {
  // For each result, create a record in the database
  const insertPromises = results.map(async (result) => {
    try {
      // Check if this result already exists by DOI
      if (result.doi) {
        const [existing] = await db
          .select()
          .from(monitorResults)
          .where(eq(monitorResults.doi, result.doi));

        if (existing) {
          console.log(`Result with DOI ${result.doi} already exists, skipping`);
          return null;
        }
      }

      // Determine which keywords matched
      const matchedKeywords = [];
      const title = result.title.toLowerCase();
      const abstract = result.abstract ? result.abstract.toLowerCase() : "";

      keywords.forEach((keyword) => {
        const term = keyword.term.toLowerCase();
        if (title.includes(term) || abstract.includes(term)) {
          matchedKeywords.push(keyword.term);
        }
      });

      if (matchedKeywords.length === 0) {
        console.log(`No keywords matched for ${result.title}, skipping`);
        return null;
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
          status: "pending",
          source,
          foundAt: new Date(),
        })
        .returning();

      return insertedResult;
    } catch (error) {
      console.error(`Error saving result:`, error);
      return null;
    }
  });

  const savedResults = await Promise.all(insertPromises);
  return savedResults.filter(Boolean);
}

/**
 * Search PubMed for the given keywords
 */
async function searchPubMed(searchTerms: string[]) {
  // For demo purposes, this is a simplified version
  // In production, this would connect to the PubMed API
  try {
    const searchString = searchTerms.join(" OR ");
    console.log(`Searching PubMed for: ${searchString}`);

    // In a real implementation, this would be a call to the PubMed API
    // For now, just simulate finding some results
    return [
      {
        title: "Effects of molecular hydrogen on health outcomes",
        abstract:
          "This study explores the emerging research on molecular hydrogen for health applications.",
        authors: "Smith J, Johnson A",
        journal: "Journal of Hydrogen Research",
        publishDate: "2025-05-01",
        doi: "10.1234/hydrogen.2025.001",
        url: "https://pubmed.example.com/article1",
      },
    ];
  } catch (error) {
    console.error("Error searching PubMed:", error);
    throw error;
  }
}

/**
 * Search CrossRef for the given keywords
 */
async function searchCrossRef(searchTerms: string[]) {
  // For demo purposes, this is a simplified version
  // In production, this would connect to the CrossRef API
  try {
    const searchString = searchTerms.join(" OR ");
    console.log(`Searching CrossRef for: ${searchString}`);

    // In a real implementation, this would be a call to the CrossRef API
    // For now, just simulate finding some results
    return [
      {
        title: "Hydrogen-rich water consumption and athletic performance",
        abstract:
          "This clinical trial investigates the effects of hydrogen-rich water on recovery time in athletes.",
        authors: "Brown K, Davis L",
        journal: "Sports Medicine Research",
        publishDate: "2025-04-15",
        doi: "10.5678/sportmed.2025.002",
        url: "https://crossref.example.com/article2",
      },
    ];
  } catch (error) {
    console.error("Error searching CrossRef:", error);
    throw error;
  }
}

/**
 * Search Europe PMC for the given keywords
 */
async function searchEuropePMC(searchTerms: string[]) {
  // For demo purposes, this is a simplified version
  // In production, this would connect to the Europe PMC API
  try {
    const searchString = searchTerms.join(" OR ");
    console.log(`Searching Europe PMC for: ${searchString}`);

    // In a real implementation, this would be a call to the Europe PMC API
    // For now, just simulate finding some results
    return [
      {
        title: "Hydrogen therapy in neurological conditions",
        abstract:
          "This review examines the potential of hydrogen gas inhalation in treating various neurological disorders.",
        authors: "Wilson P, Taylor R",
        journal: "European Journal of Neurology",
        publishDate: "2025-03-20",
        doi: "10.9012/neurojour.2025.003",
        url: "https://europepmc.example.com/article3",
      },
    ];
  } catch (error) {
    console.error("Error searching Europe PMC:", error);
    throw error;
  }
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

    // Run the searches
    const results = await runScheduledSearch(schedule.sources, activeKeywords);

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
    return { success: false, error: error.message };
  }
}
