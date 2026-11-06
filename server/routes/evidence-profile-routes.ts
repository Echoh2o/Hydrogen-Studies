/**
 * TRUST-BADGE-PLAN Phase 1.2–1.4 — public, credential-free evidence data for
 * the echowater.com badge, modal and claim widget. Mounted before the CORS
 * allowlist (like /embed): any origin, no cookies.
 *
 *   GET /api/evidence/:product               counts, matched studies, rule, version
 *   GET /api/evidence/:product/topic/:topic  claim-widget numbers (Appendix E topics only)
 *   GET /badge/:product.svg?v=<version>      server-rendered badge (no-JS fallback)
 *
 * 404 unless the product exists, has a lab-measured concentration AND its
 * badge is enabled (products.badge_enabled — flipped after Josh approves the
 * copy). DB errors answer 503 with no numbers, never zeros.
 */
import { Router, type Response } from "express";
import { getEvidenceProfile, getTopicEvidence } from "../services/evidence-profile";
import { doseMatchRuleText, topicRuleText, CLAIM_TOPICS, EVIDENCE_RULE_VERSION } from "../../shared/evidence-match";
import { BADGE, CLAIM_WIDGET, COPY_APPROVAL, PROFILE, mixPhrase, fmt, ppmLabel } from "../../shared/evidence-badge-copy";
import { STUDY_REVIEWER } from "../../shared/reviewer";
import { getStudyDoseModule } from "../services/study-dose";
import { logger } from "../utils/logger";

const SITE_URL = process.env.SITE_URL || "https://hydrogenstudies.com";
const router = Router();

function headers(res: Response, maxAge: number): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", `public, max-age=${maxAge}`);
  res.setHeader("X-Robots-Tag", "noindex");
}

/** PLAN 5.1: the SPA's copy of the study-page dose module (Next gets it via page-data). */
router.get("/api/studies/:id/dose-module", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "bad id" });
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({ module: await getStudyDoseModule(id) });
});

const studyLink = (s:{ pmid: string | null; doi: string | null }) =>
  s.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/` : s.doi ? `https://doi.org/${s.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")}` : null;

router.get("/api/evidence/:product", async (req, res) => {
  try {
    const p = await getEvidenceProfile(req.params.product);
    if (!p || !p.product.badgeEnabled) {
      headers(res, 60);
      return res.status(404).json({ error: "not found" });
    }
    const { product, match: d } = p;
    const ppm = product.certifiedConcentrationPpm as number;
    headers(res, 300);
    res.json({
      product: {
        slug: product.slug, name: product.name, certifiedConcentrationMgL: ppm, lab: product.lab, reportId: product.reportId,
        testDate: product.testDate, measured: product.measuredSummary, reportUrl: product.reportUrl,
      },
      rule: { version: EVIDENCE_RULE_VERSION, text: doseMatchRuleText({ slug: product.slug, name: product.name, deliveryRoute: product.deliveryRoute, certifiedConcentrationPpm: ppm }) },
      counts: {
        humanStudies: d.humanStudies, drinkingStudies: d.drinkingStudies, withConcentration: d.withConcentration,
        notReported: d.notReported, matched: d.matched.length, outcomes: d.mix,
        fundedByEcho: d.fundedByEcho, usedEchoDevice: d.usedEchoDevice, fundingStated: d.fundingStated,
      },
      copy: {
        badgeLine1: BADGE.line1(d), badgeLine2: BADGE.line2(d, ppmLabel(ppm)), cta: BADGE.cta, source: BADGE.source,
        summary: PROFILE.summary(d, product.name, ppmLabel(ppm)), echoDevice: PROFILE.echoDevice(d), echoFunding: PROFILE.echoFunding(d),
        disclosure: PROFILE.disclosure, notAdvice: PROFILE.notAdvice, approved: COPY_APPROVAL,
      },
      matched: d.matched.map((s) => ({
        id: s.id, title: s.title, year: s.publishYear, design: s.studyDesign, participants: s.sampleSize, durationDays: s.durationDays,
        concentrationMgL: s.concentrationPpm, result: s.effectDirection, url: `${SITE_URL}/study/${s.slug}`, source: studyLink(s),
      })),
      reviewer: { name: STUDY_REVIEWER.name, title: `${STUDY_REVIEWER.jobTitle}, ${STUDY_REVIEWER.employer}`, credentials: STUDY_REVIEWER.credentials, profile: `${SITE_URL}${STUDY_REVIEWER.profileHref}` },
      methodology: `${SITE_URL}/methodology`,
      evidencePage: `${SITE_URL}/evidence/${product.slug}`,
      version: p.version,
      generatedAt: p.generatedAt,
    });
  } catch (err) {
    logger.error("evidence profile API failed", err, "EvidenceProfile");
    headers(res, 30);
    res.status(503).json({ error: "temporarily unavailable" });
  }
});

router.get("/api/evidence/:product/topic/:topic", async (req, res) => {
  try {
    const p = await getEvidenceProfile(req.params.product);
    const t = await getTopicEvidence(req.params.topic);
    if (!p || !p.product.badgeEnabled || !t) {
      headers(res, 60);
      return res.status(404).json({ error: "not found" });
    }
    headers(res, 300);
    res.json({
      topic: t.topic,
      label: CLAIM_TOPICS[t.topic].label,
      count: t.count,
      outcomes: t.mix,
      line: CLAIM_WIDGET.line(t.count, t.mix),
      cta: CLAIM_WIDGET.cta,
      rule: topicRuleText(t.topic),
      studies: t.studies.map((s) => ({ title: s.title, year: s.publishYear, result: s.effectDirection, url: `${SITE_URL}/study/${s.slug}`, source: studyLink(s) })),
      version: t.version,
    });
  } catch (err) {
    logger.error("evidence topic API failed", err, "EvidenceProfile");
    headers(res, 30);
    res.status(503).json({ error: "temporarily unavailable" });
  }
});

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

router.get("/badge/:product.svg", async (req, res) => {
  try {
    const p = await getEvidenceProfile(req.params.product);
    if (!p || !p.product.badgeEnabled) {
      headers(res, 60);
      return res.status(404).type("text/plain").send("not found");
    }
    const ppm = p.product.certifiedConcentrationPpm as number;
    const l1 = BADGE.line1(p.match);
    const l2 = `${BADGE.line2(p.match, ppmLabel(ppm))} → ${BADGE.cta}`;
    const dark = req.query.theme === "dark";
    const c = dark ? { bg: "#0F172A", text: "#F8FAFC", muted: "#94A3B8", accent: "#5EEAD4", border: "#334155" } : { bg: "#FFFFFF", text: "#0F172A", muted: "#475569", accent: "#0F766E", border: "#CBD5E1" };
    const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="76" viewBox="0 0 420 76" role="img" aria-labelledby="t"><title id="t">${esc(`${l1}. ${BADGE.line2(p.match, ppmLabel(ppm))}. ${BADGE.source}.`)}</title><rect x="0.5" y="0.5" width="419" height="75" rx="10" fill="${c.bg}" stroke="${c.border}"/><text x="16" y="25" fill="${c.text}" font-family="${font}" font-size="14" font-weight="700">${esc(l1)}</text><text x="16" y="45" fill="${c.accent}" font-family="${font}" font-size="13" font-weight="600">${esc(l2)}</text><text x="16" y="64" fill="${c.muted}" font-family="${font}" font-size="10.5">${esc(BADGE.source)}</text></svg>`;
    // Versioned URLs (?v=) are immutable: the version changes whenever the numbers do.
    headers(res, req.query.v ? 31536000 : 3600);
    if (req.query.v) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.type("image/svg+xml").send(svg);
  } catch (err) {
    logger.error("evidence badge SVG failed", err, "EvidenceProfile");
    headers(res, 30);
    res.status(503).type("text/plain").send("temporarily unavailable");
  }
});

export default router;
export { fmt, mixPhrase };
