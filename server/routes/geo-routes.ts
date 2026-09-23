import { Router, type Request, type Response } from "express";
import { isConsentRequiredCountry, normalizeCountry } from "@shared/consent-regions";

/**
 * GET /api/geo → { country, consentRequired }
 *
 * Tells the SPA whether to show the analytics consent banner (EEA/UK/CH only).
 * The country comes from Cloudflare's CF-IPCountry header. This is a separate,
 * uncached request on purpose: the answer is per-visitor, so it must never be
 * baked into (cacheable) HTML. No DB, no session, nothing stored.
 *
 * Missing header (local dev, origin hit directly) → consentRequired=false. The
 * GA4 side stays safe regardless: Google applies the regional "denied"
 * Consent Mode default from its own geolocation, not from this endpoint.
 */
export function geoHandler(req: Request, res: Response): void {
  const country = normalizeCountry(req.get("cf-ipcountry"));
  res.set("Cache-Control", "no-store");
  res.json({ country, consentRequired: isConsentRequiredCountry(country) });
}

const router = Router();
router.get("/api/geo", geoHandler);

export default router;
