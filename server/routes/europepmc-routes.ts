import express from "express";
import {
  searchEuropePMC,
  getArticleByPMID,
  getArticleByPMCID,
  getArticleByDOI,
  extractStudyFromEuropePMC,
} from "../europepmc-api";
import { storage } from "../storage";

const router = express.Router();

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
router.post("/api/europepmc/import/doi/:doi", async (req, res) => {
  try {
    const { doi } = req.params;

    if (!doi) {
      return res.status(400).json({
        success: false,
        message: "DOI is required",
      });
    }

    // Check if study with this DOI already exists
    const existingStudy = await storage.getStudyByIdentifier(doi);

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

    // Create study in database
    const createdStudy = await storage.createStudy(studyData);

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
router.put("/api/europepmc/update-journal-date/:doi", async (req, res) => {
  try {
    const { doi } = req.params;

    if (!doi) {
      return res.status(400).json({
        success: false,
        message: "DOI is required",
      });
    }

    // Check if study with this DOI exists
    const existingStudy = await storage.getStudyByIdentifier(doi);

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
    const updatedStudy = await storage.updateStudy(existingStudy.id, {
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

export default router;
