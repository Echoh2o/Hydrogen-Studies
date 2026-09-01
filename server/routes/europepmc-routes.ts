import express from "express";
import {
  searchEuropePMC,
  getArticleByPMID,
  getArticleByPMCID,
  getArticleByDOI,
  extractStudyFromEuropePMC,
} from "../services/europepmc-api";
import { studyService } from "../services/study-service";
import { requireAdmin } from "../auth";
import { searchRateLimiter } from "../utils/rate-limiting";

const router = express.Router();

// Public proxy to Europe PMC's REST API — throttle so an anonymous caller
// can't burn the upstream quota or get the server IP rate-banned. Admins skip.
//
// SCOPED to this router's own path family (PLAN.md 0.2b). This router is
// mounted at the app root (`app.use(europePmcRoutes)`) because its routes
// declare full /api/europepmc/* paths — so the previous bare
// `router.use(searchRateLimiter)` silently rate-limited EVERY request on the
// site at 30/min/IP. That was the site-wide "app limiter" the growth plan
// flagged: a plain-UA crawl got 429s on 5,467 of 5,525 pages (verified
// 2026-09-01), and with the old Cloudflare-colo bucket keying it throttled
// real crawlers too.
router.use("/api/europepmc", searchRateLimiter);

/**
 * Search Europe PMC for studies
 */
router.get("/api/europepmc/search", async (req, res) => {
  try {
    const { query, page = "1", pageSize = "10" } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const results = await searchEuropePMC(
      query as string,
      parseInt(page as string),
      parseInt(pageSize as string),
    );

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Europe PMC search error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search Europe PMC API",
    });
  }
});

/**
 * Get article details by DOI from Europe PMC
 */
router.get("/api/europepmc/doi/:doi", async (req, res) => {
  try {
    const { doi } = req.params;

    if (!doi) {
      return res.status(400).json({
        success: false,
        message: "DOI is required",
      });
    }

    const article = await getArticleByDOI(doi);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found with provided DOI",
      });
    }

    res.json({
      success: true,
      data: article,
    });
  } catch (error) {
    console.error("Europe PMC DOI lookup error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch article from Europe PMC API",
    });
  }
});

/**
 * Get article details by PMID from Europe PMC
 */
router.get("/api/europepmc/pmid/:pmid", async (req, res) => {
  try {
    const { pmid } = req.params;

    if (!pmid) {
      return res.status(400).json({
        success: false,
        message: "PubMed ID is required",
      });
    }

    const article = await getArticleByPMID(pmid);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found with provided PMID",
      });
    }

    res.json({
      success: true,
      data: article,
    });
  } catch (error) {
    console.error("Europe PMC PMID lookup error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch article from Europe PMC API",
    });
  }
});

/**
 * Get article details by PMCID from Europe PMC
 */
router.get("/api/europepmc/pmcid/:pmcid", async (req, res) => {
  try {
    const { pmcid } = req.params;

    if (!pmcid) {
      return res.status(400).json({
        success: false,
        message: "PubMed Central ID is required",
      });
    }

    const article = await getArticleByPMCID(pmcid);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found with provided PMCID",
      });
    }

    res.json({
      success: true,
      data: article,
    });
  } catch (error) {
    console.error("Europe PMC PMCID lookup error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch article from Europe PMC API",
    });
  }
});

/**
 * Import article from Europe PMC by DOI
 */
router.post("/api/europepmc/import/doi/:doi", requireAdmin, async (req, res) => {
  try {
    const { doi } = req.params;

    if (!doi) {
      return res.status(400).json({
        success: false,
        message: "DOI is required",
      });
    }

    // Check if study with this DOI already exists
    const existingStudy = await studyService.getStudyByIdentifier(doi);

    if (existingStudy) {
      return res.status(409).json({
        success: false,
        message: "Study with this DOI already exists",
        studyId: existingStudy.id,
      });
    }

    // Get article data from Europe PMC
    const articleData = await getArticleByDOI(doi);

    if (!articleData) {
      return res.status(404).json({
        success: false,
        message: "Article not found with provided DOI",
      });
    }

    // Extract study data from article
    const studyData = extractStudyFromEuropePMC(articleData);

    if (!studyData) {
      return res.status(422).json({
        success: false,
        message: "Could not extract study data from the article",
      });
    }

    // Create study in database
    const createdStudy = await studyService.createStudy(studyData);

    res.status(201).json({
      success: true,
      message: "Study successfully imported from Europe PMC",
      study: createdStudy,
    });
  } catch (error) {
    console.error("Europe PMC import error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to import study from Europe PMC API",
    });
  }
});

/**
 * Update journal publication date by DOI using Europe PMC API
 */
router.put("/api/europepmc/update-journal-date/:doi", requireAdmin, async (req, res) => {
  try {
    const { doi } = req.params;

    if (!doi) {
      return res.status(400).json({
        success: false,
        message: "DOI is required",
      });
    }

    // Check if study with this DOI exists
    const existingStudy = await studyService.getStudyByIdentifier(doi);

    if (!existingStudy) {
      return res.status(404).json({
        success: false,
        message: "Study with this DOI not found",
      });
    }

    // Get article data from Europe PMC
    const articleData = await getArticleByDOI(doi);

    if (!articleData) {
      return res.status(404).json({
        success: false,
        message: "Article not found in Europe PMC with provided DOI",
      });
    }

    // Extract publication date data
    let journalPublishDate = null;

    // First priority: Try to get journalInfo.journalIssueDate
    if (articleData.journalInfo?.journalIssueDate) {
      const dateStr = articleData.journalInfo.journalIssueDate;
      // Format date to YYYY-MM-DD
      const dateParts = dateStr.split(" ");
      if (dateParts.length === 3) {
        const year = dateParts[0];
        const month = getMonthNumber(dateParts[1]);
        const day = dateParts[2].padStart(2, "0");
        journalPublishDate = `${year}-${month}-${day}`;
      } else if (dateParts.length === 2) {
        const year = dateParts[0];
        const month = getMonthNumber(dateParts[1]);
        journalPublishDate = `${year}-${month}-01`;
      } else if (dateParts.length === 1) {
        journalPublishDate = `${dateParts[0]}-01-01`;
      }
    }

    // Second priority: Try to get firstPublicationDate
    if (!journalPublishDate && articleData.firstPublicationDate) {
      const dateStr = articleData.firstPublicationDate;
      // Format date to YYYY-MM-DD
      const dateParts = dateStr.split(" ");
      if (dateParts.length === 3) {
        const year = dateParts[0];
        const month = getMonthNumber(dateParts[1]);
        const day = dateParts[2].padStart(2, "0");
        journalPublishDate = `${year}-${month}-${day}`;
      } else if (dateParts.length === 2) {
        const year = dateParts[0];
        const month = getMonthNumber(dateParts[1]);
        journalPublishDate = `${year}-${month}-01`;
      } else if (dateParts.length === 1) {
        journalPublishDate = `${dateParts[0]}-01-01`;
      }
    }

    // Third priority: Try to get electronicPublicationDate
    if (!journalPublishDate && articleData.electronicPublicationDate) {
      const dateStr = articleData.electronicPublicationDate;
      // Format date to YYYY-MM-DD
      const dateParts = dateStr.split(" ");
      if (dateParts.length === 3) {
        const year = dateParts[0];
        const month = getMonthNumber(dateParts[1]);
        const day = dateParts[2].padStart(2, "0");
        journalPublishDate = `${year}-${month}-${day}`;
      } else if (dateParts.length === 2) {
        const year = dateParts[0];
        const month = getMonthNumber(dateParts[1]);
        journalPublishDate = `${year}-${month}-01`;
      } else if (dateParts.length === 1) {
        journalPublishDate = `${dateParts[0]}-01-01`;
      }
    }

    if (!journalPublishDate) {
      return res.status(404).json({
        success: false,
        message: "Could not find publication date in Europe PMC data",
      });
    }

    // Update study in database
    const updatedStudy = await studyService.updateStudy(existingStudy.id, {
      journalPublishDate,
    });

    res.json({
      success: true,
      message: "Journal publication date successfully updated",
      study: updatedStudy,
    });
  } catch (error) {
    console.error("Europe PMC date update error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update journal publication date from Europe PMC",
    });
  }
});

/**
 * Helper function to convert month name to number
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
 * POST /api/europepmc/save
 * Save a Europe PMC article to the studies database.
 * Accepts { id, source } where id is a PMID/PMCID and source is "MED"/"PMC"/etc.
 */
router.post("/api/europepmc/save", requireAdmin, async (req, res) => {
  try {
    const { id, source } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Article ID is required",
      });
    }

    // Fetch the article by PMID or PMCID
    let articleData;
    if (source === "PMC" || String(id).startsWith("PMC")) {
      articleData = await getArticleByPMCID(String(id));
    } else {
      articleData = await getArticleByPMID(String(id));
    }

    if (!articleData) {
      return res.status(404).json({
        success: false,
        message: "Article not found in Europe PMC",
      });
    }

    // Check for duplicates by DOI if available
    const doi = articleData.doi || articleData.DOI;
    if (doi) {
      const existing = await studyService.getStudyByIdentifier(doi);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Study with this DOI already exists",
          studyId: existing.id,
        });
      }
    }

    // Extract and save
    const studyData = extractStudyFromEuropePMC(articleData);
    if (!studyData) {
      return res.status(422).json({
        success: false,
        message: "Could not extract study data from the article",
      });
    }

    const createdStudy = await studyService.createStudy(studyData);

    res.status(201).json({
      success: true,
      message: "Study successfully imported from Europe PMC",
      study: createdStudy,
    });
  } catch (error: any) {
    console.error("Europe PMC save error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to save study from Europe PMC",
    });
  }
});

export default router;
