/**
 * Scraper Routes
 * Endpoints for previewing and saving studies from external URLs
 * Supports: PubMed, Europe PMC, CrossRef/DOI, Semantic Scholar
 */

import { Router, Request, Response } from "express";
import { requireAdmin } from "../auth";
import { getArticleByPMID, getArticleByDOI, extractStudyFromEuropePMC } from "../services/europepmc-api";
import { getCrossRefArticleByDOI, extractStudyFromCrossRef } from "../services/crossref-api";
import { db } from "../db";
import { studies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { externalApi } from "../utils/http";

const router = Router();

/**
 * Detect the platform from a URL and extract the identifier
 */
function detectPlatformAndId(url: string): { platform: string; id: string } | null {
  const lowerUrl = url.toLowerCase();

  // PubMed: https://pubmed.ncbi.nlm.nih.gov/12345678/
  const pubmedMatch = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/);
  if (pubmedMatch) {
    return { platform: "pubmed", id: pubmedMatch[1] };
  }

  // PubMed Central: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12345/
  const pmcMatch = url.match(/pmc\/articles\/(PMC\d+)/i);
  if (pmcMatch) {
    return { platform: "pmc", id: pmcMatch[1] };
  }

  // Europe PMC: https://europepmc.org/article/med/12345678
  const europepmcMatch = url.match(/europepmc\.org\/article\/\w+\/(\d+)/);
  if (europepmcMatch) {
    return { platform: "europepmc", id: europepmcMatch[1] };
  }

  // DOI: https://doi.org/10.xxxx/yyyy or contains doi.org
  const doiMatch = url.match(/doi\.org\/(10\.\d{4,}\/[^\s]+)/);
  if (doiMatch) {
    return { platform: "doi", id: doiMatch[1] };
  }

  // Semantic Scholar: https://www.semanticscholar.org/paper/xxx/yyy
  const semanticMatch = url.match(/semanticscholar\.org\/paper\/[^/]+\/([a-f0-9]+)/i);
  if (semanticMatch) {
    return { platform: "semanticscholar", id: semanticMatch[1] };
  }

  // Try to extract a DOI from any URL
  const genericDoiMatch = url.match(/(10\.\d{4,}\/[^\s&?#]+)/);
  if (genericDoiMatch) {
    return { platform: "doi", id: genericDoiMatch[1] };
  }

  return null;
}

/**
 * Fetch study data from the detected platform
 */
async function fetchStudyFromUrl(url: string): Promise<any> {
  const detected = detectPlatformAndId(url);

  if (!detected) {
    throw new Error("Could not detect a supported platform from this URL. Supported: PubMed, Europe PMC, CrossRef/DOI, Semantic Scholar.");
  }

  const { platform, id } = detected;
  console.log(`Detected platform: ${platform}, ID: ${id}`);

  switch (platform) {
    case "pubmed":
    case "europepmc": {
      // Use Europe PMC to fetch by PMID
      const article = await getArticleByPMID(id);
      if (!article) throw new Error(`No article found for PMID: ${id}`);
      return extractStudyFromEuropePMC(article);
    }

    case "pmc": {
      // Use Europe PMC to fetch by DOI search or PMCID
      const response = await externalApi.get("https://www.ebi.ac.uk/europepmc/webservices/rest/search", {
        params: { query: `PMCID:${id}`, resultType: "core", format: "json" },
      });
      if (response.data.hitCount > 0 && response.data.resultList.result.length > 0) {
        return extractStudyFromEuropePMC(response.data.resultList.result[0]);
      }
      throw new Error(`No article found for PMCID: ${id}`);
    }

    case "doi": {
      // Try Europe PMC first, fall back to CrossRef
      try {
        const epmcArticle = await getArticleByDOI(id);
        if (epmcArticle) {
          return extractStudyFromEuropePMC(epmcArticle);
        }
      } catch (err) {
        console.log("Europe PMC DOI lookup failed, trying CrossRef...");
      }

      const crossrefData = await getCrossRefArticleByDOI(id);
      if (crossrefData) {
        return extractStudyFromCrossRef(crossrefData);
      }
      throw new Error(`No article found for DOI: ${id}`);
    }

    case "semanticscholar": {
      // Use Semantic Scholar API
      const response = await externalApi.get(
        `https://api.semanticscholar.org/graph/v1/paper/${id}`,
        {
          params: {
            fields: "title,abstract,authors,year,venue,publicationDate,externalIds,url,citationCount,isOpenAccess,openAccessPdf",
          },
        },
      );

      const paper = response.data;
      if (!paper) throw new Error(`No article found on Semantic Scholar: ${id}`);

      return {
        title: paper.title || "Untitled",
        abstract: paper.abstract || "",
        authors: paper.authors?.map((a: any) => a.name).join(", ") || "Unknown",
        journal: paper.venue || "Unknown Journal",
        publishDate: paper.publicationDate || (paper.year ? `${paper.year}-01-01` : new Date().toISOString().split("T")[0]),
        publishYear: paper.year || null,
        doi: paper.externalIds?.DOI || null,
        pdfUrl: paper.openAccessPdf?.url || null,
        peerReviewed: true,
        category: "General",
        sourceUrl: url,
      };
    }

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * POST /api/scraper/preview-url
 * Extract study data from a URL without saving
 */
router.post("/preview-url", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ success: false, message: "A valid URL is required" });
    }

    console.log(`Scraper preview request for: ${url}`);
    const study = await fetchStudyFromUrl(url.trim());

    if (!study) {
      return res.status(404).json({ success: false, message: "Could not extract study data from this URL" });
    }

    res.json({ success: true, study, message: "Study data extracted successfully" });
  } catch (error: any) {
    console.error("Scraper preview error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to extract study data from URL",
    });
  }
});

/**
 * POST /api/scraper/save-url
 * Extract study data from a URL and save to database
 */
router.post("/save-url", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ success: false, message: "A valid URL is required" });
    }

    console.log(`Scraper save request for: ${url}`);
    const studyData = await fetchStudyFromUrl(url.trim());

    if (!studyData) {
      return res.status(404).json({ success: false, message: "Could not extract study data from this URL" });
    }

    // Check for duplicates by DOI or title
    if (studyData.doi) {
      const existing = await db.select({ id: studies.id })
        .from(studies)
        .where(eq(studies.doi, studyData.doi))
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: `A study with DOI ${studyData.doi} already exists (ID: ${existing[0].id})`,
          study: studyData,
        });
      }
    }

    // Generate slug from title
    const slug = studyData.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 100)
      .trim();

    // Insert into database
    const [savedStudy] = await db.insert(studies).values({
      ...studyData,
      slug,
      sourceUrl: url,
      importedAt: new Date(),
    }).returning();

    res.json({
      success: true,
      study: savedStudy,
      message: `Study "${savedStudy.title}" saved successfully`,
    });
  } catch (error: any) {
    console.error("Scraper save error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This study already exists in the database",
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || "Failed to save study from URL",
    });
  }
});

export default router;
