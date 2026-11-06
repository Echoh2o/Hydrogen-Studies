/**
 * /evidence/:product — TRUST-BADGE-PLAN Phase 1.5. The full evidence profile
 * behind the echowater.com badge: counts with denominators, the rule in plain
 * language, every matched study (null and negative results included), the
 * lab report, reviewer, date and methodology link. noindex at launch (Josh,
 * 2026-11-05). Copy: shared/evidence-badge-copy.ts.
 */
import { esc, breadcrumbs, footer } from "./html-fragments";
import { getTopConditions, renderBylineHtml } from "./seo-body-renderer";
import { blogByline, EDITORIAL_TEAM, formatLongDate } from "../../shared/seo-markup";
import { pageBreadcrumbs } from "../../shared/breadcrumbs";
import { STUDY_REVIEWER, reviewerBylineLabel } from "../../shared/reviewer";
import { doseMatchRuleText } from "../../shared/evidence-match";
import { PROFILE, ROUTE_COPY, fmt, measureLabel } from "../../shared/evidence-badge-copy";
import { getEvidenceProfile } from "../services/evidence-profile";
import { studyEvidence } from "../../shared/study-page";

const DIRECTION: Record<string, string> = { improved: "Improved", no_clear_effect: "No clear effect", worsened: "Worsened", mixed: "Mixed", not_reported: "Not reported" };

/** Empty string → the page-data route answers 404 (unknown product or badge not enabled). */
export async function renderEvidenceProfilePage(slug: string): Promise<string> {
  const p = await getEvidenceProfile(slug);
  if (!p || !p.product.badgeEnabled) return "";
  const { product, match: d } = p;
  const label = measureLabel(product);
  const rc = ROUTE_COPY[d.route];
  const h1 = PROFILE.h1(product.name);
  const conditions = await getTopConditions();
  let h = breadcrumbs(pageBreadcrumbs(h1));
  h += `<article>\n<h1>${esc(h1)}</h1>\n`;
  const by = blogByline({ authorName: EDITORIAL_TEAM, updatedAt: p.generatedAt });
  h += renderBylineHtml(by).replace("</p>\n", ` · Reviewed by <a href="${esc(STUDY_REVIEWER.profileHref)}">${esc(reviewerBylineLabel())}</a></p>\n`);
  h += `<p class="disclosure"><strong>Disclosure:</strong> ${esc(PROFILE.disclosure)}</p>\n`;
  h += `<p class="lead">${esc(PROFILE.summary(d, product.name, label))}</p>\n`;
  h += `<p>${esc(PROFILE.echoDevice(d))} ${esc(PROFILE.echoFunding(d))}</p>\n`;
  if (product.lab && product.reportId && product.testDate) {
    const cert = esc(PROFILE.certificate(product.lab, product.reportId, formatLongDate(new Date(product.testDate)), product.measuredSummary ?? label, d.route));
    h += `<p>${product.reportUrl ? `<a href="${esc(product.reportUrl)}" rel="noopener">${cert}</a>` : cert}</p>\n`;
  }
  h += `<h2 id="how-this-count-is-made">${esc(PROFILE.ruleHeading)}</h2>\n<p>${esc(doseMatchRuleText(product))}</p>\n`;
  h += `<h2 id="the-matched-studies">${esc(PROFILE.tableHeading)} (${fmt(d.matched.length)})</h2>\n`;
  h += `<table class="evidence-table"><thead><tr><th scope="col">Study</th><th scope="col">Year</th><th scope="col">Design</th><th scope="col">People</th><th scope="col">Days</th><th scope="col">${esc(rc.tableDose)}</th><th scope="col">Main result</th><th scope="col">Source</th></tr></thead><tbody>\n`;
  for (const s of d.matched) {
    const design = studyEvidence({ studyDesign: s.studyDesign, studyType: "human", isHumanTrial: true })?.label ?? "";
    const src = s.pmid ? `<a href="https://pubmed.ncbi.nlm.nih.gov/${esc(s.pmid)}/" rel="noopener">PubMed</a>` : s.doi ? `<a href="https://doi.org/${esc(s.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, ""))}" rel="noopener">DOI</a>` : "";
    h += `<tr><td><a href="/study/${esc(s.slug)}">${esc(s.title)}</a></td><td>${s.publishYear ?? ""}</td><td>${esc(design)}</td><td>${s.sampleSize ?? ""}</td><td>${s.durationDays ?? ""}</td><td>${(d.route === "inhaled_gas" ? s.h2FlowMlMin : s.concentrationPpm) ?? ""}</td><td>${esc(DIRECTION[s.effectDirection] ?? s.effectDirection)}</td><td>${src}</td></tr>\n`;
  }
  h += `</tbody></table>\n`;
  h += `<p>${esc(rc.notAdvice)} <a href="/methodology">${esc(PROFILE.methodology)}</a> · <a href="/products">How to compare hydrogen devices</a></p>\n`;
  h += `<p class="version">Data version ${esc(p.version)}, generated ${esc(formatLongDate(new Date(p.generatedAt)))}.</p>\n`;
  h += `</article>\n`;
  h += footer(conditions);
  return h;
}
