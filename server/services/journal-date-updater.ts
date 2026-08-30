/**
 * Journal Publication Date Updater
 * This module provides functionality to update the journal publication dates
 * for studies in the database using DOI lookups.
 */
import { db } from "../db";
import { studies } from "@shared/schema";
import { eq, isNull, not, and } from "drizzle-orm";
import { getCrossRefArticleByDOI } from "./crossref-api";
import { getArticleByDOI } from "./europepmc-api";
import { externalApi } from "../utils/http";

/**
 * Update journal publication dates for studies with DOIs
 * This function finds studies with DOIs but missing journal publication dates
 * and attempts to retrieve and update the correct publication dates.
 */
export async function updateJournalPublicationDates(
  limit: number = 50,
): Promise<{
  success: boolean;
  totalUpdated: number;
  failedDois: string[];
  message: string;
}> {
  try {
    // Find studies with DOIs but no journal publication date
    const studiesToUpdate = await db
      .select()
      .from(studies)
      .where(and(not(isNull(studies.doi)), isNull(studies.journalPublishDate)))
      .limit(limit);

    if (!studiesToUpdate.length) {
      return {
        success: true,
        totalUpdated: 0,
        failedDois: [],
        message: "No studies found that need journal publication date updates",
      };
    }

    const failedDois: string[] = [];
    let totalUpdated = 0;

    // Process each study
    for (const study of studiesToUpdate) {
      if (!study.doi) continue;

      try {
        // Find the journal publication date from multiple data sources
        const journalPublishDate = await findJournalPublicationDate(study.doi);

        if (!journalPublishDate) {
          failedDois.push(study.doi);
          continue;
        }

        // Update the study with the found date
        await db
          .update(studies)
          .set({ journalPublishDate })
          .where(eq(studies.id, study.id));

        totalUpdated++;

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(
          `Error updating journal date for DOI ${study.doi}:`,
          error,
        );
        failedDois.push(study.doi);
      }
    }

    return {
      success: true,
      totalUpdated,
      failedDois,
      message: `Updated ${totalUpdated} studies with journal publication dates. Failed for ${failedDois.length} DOIs.`,
    };
  } catch (error) {
    console.error("Error updating journal publication dates:", error);
    return {
      success: false,
      totalUpdated: 0,
      failedDois: [],
      message: `Error updating journal publication dates: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Find the journal publication date for a study with the given DOI
 * This function tries multiple data sources to find the most accurate date
 */
async function findJournalPublicationDate(doi: string): Promise<string | null> {
  // Try CrossRef first
  try {
    // Unwrap the CrossRef envelope — published/created date-parts live under
    // .message; reading them off the envelope always returned null.
    const crossRefData = (await getCrossRefArticleByDOI(doi))?.message;
    const crossRefDate = extractCrossRefDate(crossRefData);
    if (crossRefDate) {
      return crossRefDate;
    }
  } catch (error) {
    console.log(`CrossRef lookup failed for DOI ${doi}:`, error instanceof Error ? error.message : String(error));
  }

  // Try Europe PMC as a backup
  try {
    const europePmcData = await getArticleByDOI(doi);

    // Check journal issue date
    if (europePmcData?.journalInfo?.journalIssueDate) {
      const dateStr = europePmcData.journalInfo.journalIssueDate;
      const formattedDate = formatEuropePMCDate(dateStr);
      if (formattedDate) {
        return formattedDate;
      }
    }

    // Check first publication date
    if (europePmcData?.firstPublicationDate) {
      const formattedDate = formatEuropePMCDate(
        europePmcData.firstPublicationDate,
      );
      if (formattedDate) {
        return formattedDate;
      }
    }

    // Check electronic publication date
    if (europePmcData?.electronicPublicationDate) {
      const formattedDate = formatEuropePMCDate(
        europePmcData.electronicPublicationDate,
      );
      if (formattedDate) {
        return formattedDate;
      }
    }
  } catch (error) {
    console.log(`Europe PMC lookup failed for DOI ${doi}:`, error instanceof Error ? error.message : String(error));
  }

  // Last resort: Try DOI.org API
  try {
    const response = await externalApi.get(`https://doi.org/${doi}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.data.published) {
      const publishedDate = new Date(response.data.published);
      if (!isNaN(publishedDate.getTime())) {
        return publishedDate.toISOString().split("T")[0];
      }
    }
  } catch (error) {
    console.log(`DOI.org lookup failed for DOI ${doi}:`, error instanceof Error ? error.message : String(error));
  }

  return null;
}

/**
 * Extract a properly formatted date from CrossRef data
 */
function extractCrossRefDate(data: any): string | null {
  if (!data) return null;

  // Try to get the publication date from published field
  if (data.published) {
    const dateParts = data.published["date-parts"]?.[0];
    if (dateParts && dateParts.length >= 1) {
      return formatDateParts(dateParts);
    }
  }

  // Try created date as fallback
  if (data.created) {
    const dateParts = data.created["date-parts"]?.[0];
    if (dateParts && dateParts.length >= 1) {
      return formatDateParts(dateParts);
    }
  }

  return null;
}

/**
 * Format date parts from CrossRef into YYYY-MM-DD
 */
function formatDateParts(dateParts: number[]): string {
  const year = dateParts[0];
  const month =
    dateParts.length > 1 ? String(dateParts[1]).padStart(2, "0") : "01";
  const day =
    dateParts.length > 2 ? String(dateParts[2]).padStart(2, "0") : "01";
  return `${year}-${month}-${day}`;
}

/**
 * Format a Europe PMC date (usually in 'YYYY MMM DD' format) to ISO date
 */
function formatEuropePMCDate(dateStr: string): string | null {
  try {
    const dateParts = dateStr.split(" ");
    if (dateParts.length === 0) return null;

    const year = dateParts[0];
    let month = "01";
    let day = "01";

    if (dateParts.length >= 2) {
      month = getMonthNumber(dateParts[1]);

      if (dateParts.length >= 3) {
        day = padZero(parseInt(dateParts[2]));
      }
    }

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Error formatting Europe PMC date:", error);
    return null;
  }
}

/**
 * Convert month name to month number
 */
function getMonthNumber(monthName: string): string {
  const months: { [key: string]: string } = {
    Jan: "01",
    January: "01",
    Feb: "02",
    February: "02",
    Mar: "03",
    March: "03",
    Apr: "04",
    April: "04",
    May: "05",
    Jun: "06",
    June: "06",
    Jul: "07",
    July: "07",
    Aug: "08",
    August: "08",
    Sep: "09",
    September: "09",
    Oct: "10",
    October: "10",
    Nov: "11",
    November: "11",
    Dec: "12",
    December: "12",
  };

  return months[monthName] || "01";
}

/**
 * Pad a number with leading zero if needed
 */
function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}
