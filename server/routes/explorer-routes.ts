import { Router } from "express";
import { requireAdmin } from "../auth";
import { explorerDataService } from "../services/explorer-data-service";

const router = Router();

// Coerce a year query param to an integer, falling back to `fallback` on
// missing/non-numeric input and clamping to a sane range so invalid values
// never propagate into DB queries.
function clampYear(value: string | undefined, fallback: number): number {
  const parsed = parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(new Date().getFullYear() + 1, Math.max(1900, parsed));
}

// Get timeline data
router.get("/api/explorer/timeline-data", async (req, res) => {
  try {
    // Coerce/clamp year params: fall back to defaults on NaN, keep within a sane range
    const startYear = clampYear(req.query.startYear as string | undefined, 2000);
    const endYear = clampYear(
      req.query.endYear as string | undefined,
      new Date().getFullYear(),
    );

    const data = await explorerDataService.getTimelineData(startYear, endYear);
    res.json(data);
  } catch (error) {
    console.error("Error fetching timeline data:", error);
    res.status(500).json({ error: "Failed to fetch timeline data" });
  }
});

// Get body systems data
router.get("/api/explorer/body-systems", async (req, res) => {
  try {
    const data = await explorerDataService.getBodySystemsData();
    res.json(data);
  } catch (error) {
    console.error("Error fetching body systems data:", error);
    res.status(500).json({ error: "Failed to fetch body systems data" });
  }
});

// Get study connections
router.get("/api/explorer/study-connections", async (req, res) => {
  try {
    const studyId = req.query.studyId
      ? parseInt(req.query.studyId as string)
      : undefined;
    const data = await explorerDataService.getStudyConnections(studyId);
    res.json(data);
  } catch (error) {
    console.error("Error fetching study connections:", error);
    res.status(500).json({ error: "Failed to fetch study connections" });
  }
});

// Get research evolution data
router.get("/api/explorer/research-evolution", async (req, res) => {
  try {
    const startYear = clampYear(req.query.startYear as string | undefined, 2000);
    const data = await explorerDataService.getResearchEvolution(startYear);
    res.json(data);
  } catch (error) {
    console.error("Error fetching research evolution:", error);
    res.status(500).json({ error: "Failed to fetch research evolution data" });
  }
});

// Get geographic distribution
router.get("/api/explorer/geographic-distribution", async (req, res) => {
  try {
    const data = await explorerDataService.getGeographicDistribution();
    res.json(data);
  } catch (error) {
    console.error("Error fetching geographic distribution:", error);
    res.status(500).json({ error: "Failed to fetch geographic distribution" });
  }
});

// Get comparison data for multiple studies
router.get("/api/explorer/comparison/:ids", async (req, res) => {
  try {
    const ids = req.params.ids.split(",").map((id) => parseInt(id));

    if (ids.length < 2 || ids.length > 3) {
      return res
        .status(400)
        .json({ error: "Please select 2-3 studies for comparison" });
    }

    const data = await explorerDataService.getComparisonData(ids);
    res.json(data);
  } catch (error) {
    console.error("Error fetching comparison data:", error);
    res.status(500).json({ error: "Failed to fetch comparison data" });
  }
});

// Clear cache endpoint (admin only)
router.post("/api/explorer/clear-cache", requireAdmin, async (req, res) => {
  try {
    explorerDataService.clearCache();
    res.json({ message: "Cache cleared successfully" });
  } catch (error) {
    console.error("Error clearing cache:", error);
    res.status(500).json({ error: "Failed to clear cache" });
  }
});

export default router;
