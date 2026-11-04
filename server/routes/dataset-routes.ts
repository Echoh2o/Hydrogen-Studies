/**
 * PLAN.md 6.2 — the public dataset downloads (CC BY 4.0), served by Express
 * (the /dataset page itself is rendered by the Next front door).
 *
 *   GET /dataset/hydrogen-studies.csv
 *   GET /dataset/hydrogen-studies.json
 *
 * Built from the live studies table, cached an hour (same as the sitemaps).
 * No abstracts, no prose summaries — see shared/dataset.ts DATASET_FIELDS.
 */
import { Router, type Request, type Response } from "express";
import { DATASET_LICENSE_URL, DATASET_PATH } from "../../shared/dataset";
import { getDatasetRecords, toCsv } from "../services/dataset-export";
import { renderGapMapEmbed } from "../middleware/evidence-pages";
import { GAP_MAP_PATH } from "../../shared/evidence-pages";
import { logger } from "../utils/logger";

const router = Router();
const SITE_URL = "https://hydrogenstudies.com";

function commonHeaders(res: Response, type: string, filename: string): void {
  res.set("Content-Type", type);
  res.set("Content-Disposition", `attachment; filename="${filename}"`);
  res.set("Cache-Control", "public, max-age=3600");
  res.set("Link", `<${DATASET_LICENSE_URL}>; rel="license", <${SITE_URL}${DATASET_PATH}>; rel="describedby"`);
  res.set("X-Robots-Tag", "noindex"); // the page is indexed; the files are for download
}

router.get("/dataset/hydrogen-studies.csv", async (_req: Request, res: Response) => {
  try {
    const records = await getDatasetRecords();
    commonHeaders(res, "text/csv; charset=utf-8", `hydrogen-studies-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(toCsv(records));
  } catch (err) {
    logger.error("dataset csv failed", err, "Dataset");
    res.status(500).type("text/plain").send("dataset unavailable");
  }
});

router.get("/dataset/hydrogen-studies.json", async (_req: Request, res: Response) => {
  try {
    const records = await getDatasetRecords();
    commonHeaders(res, "application/json; charset=utf-8", `hydrogen-studies-${new Date().toISOString().slice(0, 10)}.json`);
    res.send(
      JSON.stringify({
        name: "The Hydrogen Studies dataset",
        url: `${SITE_URL}${DATASET_PATH}`,
        license: DATASET_LICENSE_URL,
        generatedAt: new Date().toISOString(),
        count: records.length,
        records,
      }),
    );
  } catch (err) {
    logger.error("dataset json failed", err, "Dataset");
    res.status(500).json({ error: "dataset unavailable" });
  }
});

/**
 * PLAN 6.3 — the evidence gap map as a standalone document for <iframe>
 * embedding on other sites. Helmet's frame-ancestors 'self' is replaced for
 * this one response (there is nothing here but a table and a link back).
 */
router.get(`${GAP_MAP_PATH}/embed`, async (_req: Request, res: Response) => {
  try {
    const html = await renderGapMapEmbed();
    res.removeHeader("X-Frame-Options");
    res.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors *");
    res.set("Cache-Control", "public, max-age=3600");
    res.set("X-Robots-Tag", "noindex");
    res.type("html").send(html);
  } catch (err) {
    logger.error("gap map embed failed", err, "Dataset");
    res.status(500).type("text/plain").send("embed unavailable");
  }
});

export default router;
