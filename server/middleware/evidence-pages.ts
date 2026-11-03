/**
 * PLAN.md 4.6 — the radical-honesty pages, rendered for every visitor through
 * the page-data → Next pipeline:
 *
 *   /limits-of-the-evidence     what the database can and cannot support,
 *                               with every number computed live
 *   /null-and-negative-results  the studies whose recorded outcome is
 *                               neutral, negative or mixed — surfaced, not buried
 *
 * The prose is reviewed (LIMITS_LAST_REVIEWED); the numbers come from
 * server/services/evidence-stats.ts each time the page is built.
 */
import { EDITORIAL_TEAM, blogByline, formatLongDate } from "../../shared/seo-markup";
import { pageBreadcrumbs } from "../../shared/breadcrumbs";
import {
  LIMITS_H1,
  LIMITS_LAST_REVIEWED,
  LIMITS_PATH,
  NULL_RESULTS_H1,
  NULL_RESULTS_PATH,
  fmtInt,
  pct,
} from "../../shared/evidence-pages";
import { getEvidenceStats, getNonPositiveStudies, type EvidenceStats } from "../services/evidence-stats";
import { getTopConditions, renderBylineHtml } from "./seo-body-renderer";
import { breadcrumbs, esc, footer } from "./html-fragments";

const DESIGN_LABELS: Record<string, string> = {
  meta_analysis: "Systematic reviews and meta-analyses",
  rct: "Randomized controlled trials",
  controlled_trial: "Controlled trials (non-randomized)",
  uncontrolled_trial: "Uncontrolled trials (single-arm or pilot)",
  observational: "Observational studies",
  case_report: "Case reports",
  review: "Reviews and commentaries",
  animal: "Animal studies",
  in_vitro: "Laboratory studies (cells or tissue)",
  other: "Other",
  unknown: "Design not yet classified",
};

const HUMAN_DESIGNS = new Set(["meta_analysis", "rct", "controlled_trial", "uncontrolled_trial", "observational", "case_report"]);

function designTable(s: EvidenceStats): string {
  let h = `<table><thead><tr><th>Study design</th><th>Studies</th><th>Share</th></tr></thead><tbody>`;
  for (const d of s.designs) {
    h += `<tr><td>${esc(DESIGN_LABELS[d.design] ?? d.design)}</td><td>${fmtInt(d.n)}</td><td>${pct(d.n, s.total)}</td></tr>`;
  }
  h += `</tbody></table>\n`;
  return h;
}

export async function renderLimitsPage(): Promise<string> {
  const [s, conditions] = await Promise.all([getEvidenceStats(), getTopConditions()]);
  const humanDesigns = s.designs.filter((d) => HUMAN_DESIGNS.has(d.design)).reduce((a, d) => a + d.n, 0);
  const animal = s.designs.find((d) => d.design === "animal")?.n ?? 0;
  const inVitro = s.designs.find((d) => d.design === "in_vitro")?.n ?? 0;
  const reviews = s.designs.find((d) => d.design === "review")?.n ?? 0;
  const rct = s.designs.find((d) => d.design === "rct")?.n ?? 0;
  const ht = s.humanTrials;
  const o = s.outcomes;
  const nonPositive = o.neutral + o.negative + o.mixed;
  const asOf = formatLongDate(s.asOf);

  let h = breadcrumbs(pageBreadcrumbs(LIMITS_H1));
  h += `<article>\n<h1>${esc(LIMITS_H1)}</h1>\n`;
  h += renderBylineHtml(blogByline({ authorName: EDITORIAL_TEAM, updatedAt: LIMITS_LAST_REVIEWED }));
  h += `<p class="lead">This site lists ${fmtInt(s.total)} studies on molecular hydrogen. A number that large is easy to mistake for a settled body of evidence. It is not. This page shows, with figures computed from the database as of ${esc(asOf)}, how little of that research is in people, how small and short the human trials are, how lopsided the published results are, where the work comes from, and how much of it has never been repeated. The prose was last reviewed on ${esc(formatLongDate(LIMITS_LAST_REVIEWED))}.</p>\n`;

  h += `<h2 id="not-in-people">Most of the research is not in people</h2>\n`;
  h += `<p>${fmtInt(s.human)} of the ${fmtInt(s.total)} studies (${pct(s.human, s.total)}) involved human participants. ${fmtInt(animal)} (${pct(animal, s.total)}) were done in animals, ${fmtInt(inVitro)} (${pct(inVitro, s.total)}) on cells or tissue in a laboratory, and ${fmtInt(reviews)} (${pct(reviews, s.total)}) are reviews or commentaries that report no new data. Only ${fmtInt(rct)} studies are randomized controlled trials, the design that can show whether hydrogen caused an effect in people. Results in animals and cells often do not carry over to people, so a benefit shown in a rat or a dish is a reason to run a human trial, not a finding about human health.</p>\n`;
  h += designTable(s);

  h += `<h2 id="small-and-short">The human trials are small and short</h2>\n`;
  h += `<p>Of the ${fmtInt(s.human)} human studies, ${fmtInt(ht.withN)} record how many people took part. The median is ${ht.medianN == null ? "unknown" : fmtInt(Math.round(ht.medianN))} participants: ${fmtInt(ht.lt30)} studies (${pct(ht.lt30, ht.withN)}) had fewer than 30 people and ${fmtInt(ht.lt100)} (${pct(ht.lt100, ht.withN)}) fewer than 100; ${fmtInt(ht.ge100)} had 100 or more${ht.maxN ? `, the largest ${fmtInt(ht.maxN)}` : ""}. A trial of 20 people can only detect large effects and will often produce a positive or negative result by chance.</p>\n`;
  h += `<p>Duration is recorded for ${fmtInt(ht.withDuration)} human studies. The median is ${ht.medianDays == null ? "unknown" : `${fmtInt(Math.round(ht.medianDays))} days`}: ${fmtInt(ht.singleDay)} lasted a single day or a single dose, ${fmtInt(ht.upTo4Weeks)} up to four weeks, ${fmtInt(ht.to6Months)} between one and six months, and ${fmtInt(ht.over6Months)} longer than six months. Nothing in this database tells you what years of daily hydrogen water does, because almost no one has studied it.</p>\n`;

  h += `<h2 id="positive-skew">The results skew positive</h2>\n`;
  h += `<p>For ${fmtInt(o.withOutcome)} studies the pipeline records the direction of the main result. ${fmtInt(o.positive)} (${pct(o.positive, o.withOutcome)}) are positive; ${fmtInt(nonPositive)} (${pct(nonPositive, o.withOutcome)}) are neutral, negative or mixed, ${fmtInt(o.humanNonPositive)} of them in people. A field in which ${pct(o.positive, o.withOutcome)} of published studies succeed is not a field in which hydrogen works ${pct(o.positive, o.withOutcome)} of the time; it is a field in which null results are less likely to be written up, submitted and published. We list the exceptions rather than bury them: <a href="${NULL_RESULTS_PATH}">null and negative results</a>.</p>\n`;

  h += `<h2 id="where-from">Where the research comes from</h2>\n`;
  h += `<p>${s.countries
    .slice(0, 3)
    .map((c, i) => `${i === 0 ? "" : i === 2 ? " and " : ", "}${esc(c.country)} accounts for ${fmtInt(c.n)} studies (${pct(c.n, s.total)})`)
    .join("")}. Concentration in a few research communities matters: trials recruit from one population, share methods and reviewers, and publish in a connected set of journals, so agreement among them is weaker evidence than agreement among independent groups would be. ${pct(s.since2010, s.total)} of the studies were published since 2010, so this is a young literature.</p>\n`;
  h += `<ul>${s.countries.map((c) => `<li>${esc(c.country)}: ${fmtInt(c.n)} studies (${pct(c.n, s.total)})</li>`).join("")}</ul>\n`;

  h += `<h2 id="who-paid">Who paid for it is mostly unrecorded</h2>\n`;
  h += `<p>Funding is recorded for ${fmtInt(s.coverage.funding)} studies and declared conflicts of interest for ${fmtInt(s.coverage.coi)}; extraction so far has covered human studies. For the rest, a blank field means not yet recorded, not "no conflict". Device makers fund some hydrogen research, and this site is itself funded by one (see the <a href="/editorial-policy">editorial policy</a>). When funding is recorded, industry sources are shown as such, including any study funded by Echo Technologies. Only ${fmtInt(s.coverage.registrationMention)} of the ${fmtInt(s.human)} human studies mention a trial-registry identifier in their abstract, which is one rough sign of how often outcomes were pre-specified.</p>\n`;

  h += `<h2 id="replication">Few findings have been replicated</h2>\n`;
  h += `<p>Randomized trials in people cover ${fmtInt(s.replication.conditionsWithRct)} health-condition tags in this database, but only ${fmtInt(s.replication.conditionsWith2PlusRcts)} of those tags have two or more randomized trials. For most conditions the entire randomized evidence is a single trial, usually small and short, that no independent group has repeated. A result that has never been reproduced should be read as a lead, not a conclusion.</p>\n`;

  h += `<h2 id="dose">Doses and delivery vary, and often go unrecorded</h2>\n`;
  h += `<p>Hydrogen was given as water, inhaled gas, saline, baths and tablets, at concentrations and for durations that differ by orders of magnitude between studies, and no trial has compared doses head to head. The hydrogen concentration is recorded for ${fmtInt(s.coverage.concentration)} studies (${pct(s.coverage.concentration, s.total)}). Two studies that both report "hydrogen water" may have delivered very different amounts of hydrogen, so results do not add up across studies the way the headline count suggests.</p>\n`;

  h += `<h2 id="how-to-read">What this means when you read a study here</h2>\n`;
  h += `<ul>`;
  h += `<li>Check the evidence label first. Animal and laboratory results are not findings about people.</li>`;
  h += `<li>Look at the number of participants and the duration. Fewer than 30 people, or a few weeks, cannot support a general claim.</li>`;
  h += `<li>Ask whether anyone has repeated it. Most topics rest on one trial.</li>`;
  h += `<li>Notice who paid, and that for most studies we do not yet know.</li>`;
  h += `<li>Read our hub introductions, which grade the evidence per topic as "Low" or "Very low" for these reasons, and the <a href="/methodology">methodology</a> for how the numbers above are produced.</li>`;
  h += `</ul>\n`;
  h += `<p class="note">Every figure on this page is recomputed from the database when the page is built (as of ${esc(asOf)}); the text is reviewed when the method changes. Corrections: <a href="/contact">contact us</a>.</p>\n`;
  h += `</article>\n`;
  h += footer(conditions);
  return h;
}

export async function renderNullResultsHub(): Promise<string> {
  const [studies, stats, conditions] = await Promise.all([getNonPositiveStudies(), getEvidenceStats(), getTopConditions()]);
  const human = studies.filter((s) => s.isHuman);
  const other = studies.filter((s) => !s.isHuman);
  let h = breadcrumbs(pageBreadcrumbs(NULL_RESULTS_H1));
  h += `<h1>${esc(NULL_RESULTS_H1)}</h1>\n`;
  h += `<p class="lead">${fmtInt(studies.length)} of the ${fmtInt(stats.outcomes.withOutcome)} studies with a recorded outcome direction (${pct(studies.length, stats.outcomes.withOutcome)}) report a neutral, negative or mixed result for hydrogen, ${fmtInt(human.length)} of them in people. Most sites about hydrogen never mention them. They matter more than their number suggests: in a literature where ${pct(stats.outcomes.positive, stats.outcomes.withOutcome)} of published results are positive, the studies that found nothing are the ones that tell you how large the real effect could be.</p>\n`;
  h += `<p>How a study gets here: our pipeline records the direction of each study's main result from its abstract (positive, neutral, negative or mixed). A study is listed when that field is anything but positive. The classification is machine-drafted and checked in audits; if a study below is misclassified, <a href="/contact">tell us</a>. The wider context is on <a href="${LIMITS_PATH}">the limits of the evidence</a>.</p>\n`;
  const list = (items: typeof studies) => {
    let out = `<ul class="study-list">`;
    for (const s of items) {
      out += `<li><a href="/study/${esc(s.slug)}">${esc(s.title)}</a>`;
      const meta = [s.year ? String(s.year) : "", s.journal ?? "", s.evidence ?? "", `result: ${s.outcome}`].filter(Boolean).join(" · ");
      out += ` <span class="meta">— ${esc(meta)}</span></li>`;
    }
    return out + `</ul>\n`;
  };
  if (human.length) h += `<section><h2>In people (${fmtInt(human.length)})</h2>\n${list(human)}</section>\n`;
  if (other.length) h += `<section><h2>In animals, cells and reviews (${fmtInt(other.length)})</h2>\n${list(other)}</section>\n`;
  h += footer(conditions);
  return h;
}
