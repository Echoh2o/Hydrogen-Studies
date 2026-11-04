/**
 * PLAN.md 6.2 — /dataset (what the public dataset is, its fields, licence,
 * citation and downloads) and /state-of-hydrogen-research (the yearly report:
 * counts by year, design, delivery method, country, condition, journal and
 * author, plus coverage of the structured fields). Every number is computed
 * live; charts are inline SVG so the page needs no scripts.
 */
import { EDITORIAL_TEAM, blogByline, formatLongDate } from "../../shared/seo-markup";
import { pageBreadcrumbs } from "../../shared/breadcrumbs";
import {
  DATASET_CSV_PATH,
  DATASET_FIELDS,
  DATASET_H1,
  DATASET_JSON_PATH,
  DATASET_LAST_REVIEWED,
  DATASET_LICENSE_NAME,
  DATASET_LICENSE_URL,
  DATASET_PATH,
  REPORT_H1,
  REPORT_LAST_REVIEWED,
  REPORT_PATH,
  datasetCitation,
} from "../../shared/dataset";
import { LIMITS_PATH, NULL_RESULTS_PATH, fmtInt, pct } from "../../shared/evidence-pages";
import { exploreHubPath, conditionHubForValue } from "../../shared/explore-hubs";
import { getDatasetSummary, getReportStats, type ReportStats } from "../services/dataset-export";
import { getEvidenceStats } from "../services/evidence-stats";
import { getAuthorIndex, getJournalIndex } from "../services/profiles";
import { getConditionHubs, getTopConditions, renderBylineHtml } from "./seo-body-renderer";
import { breadcrumbs, esc, footer } from "./html-fragments";

const DESIGN_LABELS: Record<string, string> = {
  meta_analysis: "Systematic reviews / meta-analyses",
  rct: "Randomized controlled trials",
  controlled_trial: "Controlled trials (non-randomized)",
  uncontrolled_trial: "Uncontrolled trials",
  observational: "Observational studies",
  case_report: "Case reports",
  review: "Reviews and commentaries",
  animal: "Animal studies",
  in_vitro: "Laboratory studies",
  other: "Other",
  unknown: "Not yet classified",
};

/** Accessible horizontal bar chart: a <table> for the data, an SVG for the eye. */
function barChart(title: string, rows: { label: string; value: number; secondary?: number }[], opts: { secondaryLabel?: string } = {}): string {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const rowH = 22;
  const labelW = 170;
  const width = 640;
  const barW = width - labelW - 60;
  const height = rows.length * rowH + 8;
  let svg = `<svg class="chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(title)}">`;
  rows.forEach((r, i) => {
    const y = i * rowH + 4;
    const w = Math.max(1, Math.round((r.value / max) * barW));
    svg += `<text x="${labelW - 6}" y="${y + 15}" text-anchor="end" font-size="12">${esc(r.label)}</text>`;
    svg += `<rect x="${labelW}" y="${y + 3}" width="${w}" height="${rowH - 8}" fill="#0f766e"/>`;
    if (r.secondary != null) {
      const w2 = Math.max(0, Math.round((r.secondary / max) * barW));
      svg += `<rect x="${labelW}" y="${y + 3}" width="${w2}" height="${rowH - 8}" fill="#f59e0b"/>`;
    }
    svg += `<text x="${labelW + w + 6}" y="${y + 15}" font-size="12">${fmtInt(r.value)}${r.secondary != null ? ` (${fmtInt(r.secondary)})` : ""}</text>`;
  });
  svg += `</svg>\n`;
  let table = `<table class="chart-data"><caption>${esc(title)}</caption><thead><tr><th>Category</th><th>Studies</th>${opts.secondaryLabel ? `<th>${esc(opts.secondaryLabel)}</th>` : ""}</tr></thead><tbody>`;
  for (const r of rows) {
    table += `<tr><td>${esc(r.label)}</td><td>${fmtInt(r.value)}</td>${opts.secondaryLabel ? `<td>${fmtInt(r.secondary ?? 0)}</td>` : ""}</tr>`;
  }
  table += `</tbody></table>\n`;
  return svg + table;
}

export async function renderDatasetPage(): Promise<string> {
  const [summary, conditions] = await Promise.all([getDatasetSummary(), getTopConditions()]);
  const generated = summary.generatedAt.toISOString();
  let h = breadcrumbs(pageBreadcrumbs(DATASET_H1));
  h += `<article>\n<h1>${esc(DATASET_H1)}</h1>\n`;
  h += renderBylineHtml(blogByline({ authorName: EDITORIAL_TEAM, updatedAt: DATASET_LAST_REVIEWED }));
  h += `<p class="lead">Every study in this database, as one table you can download and reuse: ${fmtInt(summary.rows)} papers on molecular hydrogen (${fmtInt(summary.human)} in people), with the paper's identity, our design classification and the structured fields we have extracted. Free, under ${esc(DATASET_LICENSE_NAME)}. Regenerated from the live database every hour; this copy was generated ${esc(formatLongDate(summary.generatedAt))}.</p>\n`;
  h += `<ul class="downloads">`;
  h += `<li><a href="${DATASET_CSV_PATH}" rel="nofollow" download>Download CSV</a> — ${fmtInt(summary.rows)} rows, ${DATASET_FIELDS.length} columns</li>`;
  h += `<li><a href="${DATASET_JSON_PATH}" rel="nofollow" download>Download JSON</a> — the same records as an array</li>`;
  h += `</ul>\n`;

  h += `<h2 id="what-is-in-it">What is in it</h2>\n`;
  h += `<p>One row per live study: title, authors, journal, year, DOI (${fmtInt(summary.withDoi)} rows) and PubMed ID (${fmtInt(summary.withPmid)} rows) as indexed; our study-design class; whether the study was in people; sample size, duration, delivery method, hydrogen concentration, outcome direction, funding and conflict-of-interest statements where our extraction has recorded them; condition and body-system tags; country; and the paper's OpenAlex citation count with its refresh date. Fields the paper does not report are blank, never guessed.</p>\n`;
  h += `<p>What is not in it: abstracts (they belong to their publishers; each row links to the paper), our prose summaries, and the papers we have excluded as retracted or off topic (the <a href="/methodology">methodology page</a> gives the current count and reasons). Extraction coverage is partial and documented on <a href="/methodology">the methodology page</a>; the <a href="${LIMITS_PATH}">limits of the evidence</a> page shows what the numbers can and cannot support.</p>\n`;

  h += `<h2 id="fields">Fields</h2>\n`;
  h += `<table><thead><tr><th>Column</th><th>Meaning</th></tr></thead><tbody>`;
  for (const f of DATASET_FIELDS) h += `<tr><td><code>${esc(f.name)}</code></td><td>${esc(f.description)}</td></tr>`;
  h += `</tbody></table>\n`;

  h += `<h2 id="licence">Licence and citation</h2>\n`;
  h += `<p>The dataset is released under <a href="${DATASET_LICENSE_URL}" rel="license noopener">${esc(DATASET_LICENSE_NAME)}</a>: use it for anything, including commercially, as long as you credit Hydrogen Studies and link back. The underlying papers remain their authors' and publishers'; the licence covers our compilation, classification and extracted fields.</p>\n`;
  h += `<p>Suggested citation: <cite>${esc(datasetCitation(generated))}</cite></p>\n`;
  h += `<p>A persistent DOI for versioned snapshots is planned. Until then, cite the version date above; the CSV filename carries it.</p>\n`;

  h += `<h2 id="how-it-is-made">How it is made</h2>\n`;
  h += `<p>Papers enter the database from PubMed, Europe PMC and CrossRef every six hours and pass a topic screen; retracted papers are removed daily. Design classes and the structured fields are drafted by language models from the abstract or full text and checked in audits and spot checks; the outcome direction is the pipeline's reading of the main result. Full detail on <a href="/methodology">the methodology page</a>. Found an error in a row? <a href="/contact">Tell us</a> and we fix the record, which fixes the dataset.</p>\n`;
  h += `<p>For the summary numbers see <a href="${REPORT_PATH}">the state of hydrogen research</a>.</p>\n`;
  h += `</article>\n`;
  h += footer(conditions);
  return h;
}

export async function renderReportPage(): Promise<string> {
  const [s, ev, authors, journals, hubs, conditions] = await Promise.all([
    getReportStats(),
    getEvidenceStats(),
    getAuthorIndex(),
    getJournalIndex(),
    getConditionHubs(),
    getTopConditions(),
  ]);
  const asOf = formatLongDate(s.asOf);
  const year = s.asOf.getUTCFullYear();
  let h = breadcrumbs(pageBreadcrumbs(REPORT_H1));
  h += `<article>\n<h1>${esc(REPORT_H1)}</h1>\n`;
  h += renderBylineHtml(blogByline({ authorName: EDITORIAL_TEAM, updatedAt: REPORT_LAST_REVIEWED }));
  h += `<p class="lead">What the published research on molecular hydrogen looks like as a whole, as of ${esc(asOf)}: ${fmtInt(s.total)} studies, ${fmtInt(s.human)} of them in people (${pct(s.human, s.total)}). Counts by year, study design, how hydrogen was given, where the work was done, what it studied, who publishes it, and how much of it carries the details that let a reader judge it. Every figure is recomputed from <a href="${DATASET_PATH}">the open dataset</a> when this page is built; the prose was last reviewed on ${esc(formatLongDate(REPORT_LAST_REVIEWED))}.</p>\n`;

  // Headline for the current year.
  h += `<h2 id="this-year">${year} so far</h2>\n`;
  h += `<p>${fmtInt(s.thisYear.n)} studies published in ${year} have entered the database (${fmtInt(s.thisYear.human)} in people), against ${fmtInt(s.lastYear.n)} for all of ${s.lastYear.year} (${fmtInt(s.lastYear.human)} in people). The database adds papers within hours of their appearing in PubMed, so recent years fill in over time.</p>\n`;

  h += `<h2 id="by-year">Studies per year</h2>\n`;
  h += `<p>${fmtInt(s.pre2010)} studies predate 2010${s.noYear ? ` and ${fmtInt(s.noYear)} have no publication year recorded` : ""}. The chart shows all studies per year since 2010, with the number in people in orange.</p>\n`;
  h += barChart("Studies per year since 2010 (in people in brackets)", s.byYear.map((y) => ({ label: String(y.year), value: y.n, secondary: y.human })), { secondaryLabel: "In people" });

  h += `<h2 id="by-design">By study design</h2>\n`;
  h += barChart("Studies by design", ev.designs.map((d) => ({ label: DESIGN_LABELS[d.design] ?? d.design, value: d.n })));
  h += `<p>Human trials are small: the median trial has ${ev.humanTrials.medianN == null ? "an unknown number of" : fmtInt(Math.round(ev.humanTrials.medianN))} participants and lasts ${ev.humanTrials.medianDays == null ? "an unknown time" : `${fmtInt(Math.round(ev.humanTrials.medianDays))} days`}. The <a href="${LIMITS_PATH}">limits of the evidence</a> page goes through what that means.</p>\n`;

  h += `<h2 id="by-delivery">How hydrogen was given</h2>\n`;
  h += `<p>Grouped from the delivery-method field as extracted (the raw values are in the dataset).</p>\n`;
  h += barChart("Studies by delivery method", s.byDelivery.map((d) => ({ label: d.group, value: d.n })));

  h += `<h2 id="by-country">Where the research is done</h2>\n`;
  h += barChart("Top countries by corresponding institution", s.byCountry.map((c) => ({ label: c.country, value: c.n })));

  h += `<h2 id="by-condition">What it studies</h2>\n`;
  h += `<p>The twelve most frequent condition tags. Tags are assigned per study and a study can carry several; those with a hub page link to it.</p>\n`;
  h += `<ul>`;
  for (const c of s.topConditions) {
    const hub = conditionHubForValue(c.name, hubs);
    h += `<li>${hub ? `<a href="${esc(exploreHubPath("condition", hub.slug))}">${esc(hub.name || c.name)}</a>` : esc(c.name)}: ${fmtInt(c.n)} ${c.n === 1 ? "study" : "studies"}</li>`;
  }
  h += `</ul>\n`;

  h += `<h2 id="who-publishes">Who publishes it</h2>\n`;
  h += `<p>The ten journals and ten authors with the most studies in the database (<a href="/journals">all journals</a> · <a href="/researchers">all researchers</a>).</p>\n`;
  h += `<ul>`;
  for (const j of journals.list.slice(0, 10)) h += `<li><a href="/journals/${esc(j.slug)}">${esc(j.name)}</a>: ${fmtInt(j.studies.length)}</li>`;
  h += `</ul>\n<ul>`;
  for (const a of authors.list.slice(0, 10)) h += `<li><a href="/researchers/${esc(a.slug)}">${esc(a.name)}</a>: ${fmtInt(a.studies.length)}</li>`;
  h += `</ul>\n`;

  h += `<h2 id="results">What the results say</h2>\n`;
  h += `<p>Of ${fmtInt(ev.outcomes.withOutcome)} studies with a recorded outcome direction, ${fmtInt(ev.outcomes.positive)} (${pct(ev.outcomes.positive, ev.outcomes.withOutcome)}) are positive and ${fmtInt(ev.outcomes.neutral + ev.outcomes.negative + ev.outcomes.mixed)} are neutral, negative or mixed — listed under <a href="${NULL_RESULTS_PATH}">null and negative results</a>.</p>\n`;

  h += `<h2 id="coverage">How complete the record is</h2>\n`;
  h += `<table><thead><tr><th>Field</th><th>Studies with a value</th><th>Share</th></tr></thead><tbody>`;
  const cov: [string, number][] = [
    ["Sample size", s.withSampleSize],
    ["Duration", s.withDuration],
    ["Hydrogen concentration", s.withConcentration],
    ["Funding source", s.withFunding],
    ["Conflict-of-interest statement", s.withCoi],
  ];
  for (const [label, n] of cov) h += `<tr><td>${esc(label)}</td><td>${fmtInt(n)}</td><td>${pct(n, s.total)}</td></tr>`;
  h += `</tbody></table>\n`;
  h += `<p>Blank fields mean the value has not been extracted yet, or the paper does not report it. Funding and conflict-of-interest extraction has so far covered human studies.</p>\n`;

  h += `<h2 id="method">Method and reuse</h2>\n`;
  h += `<p>Everything on this page is computed from the live database each time the page is built; the same records are downloadable as CSV or JSON on <a href="${DATASET_PATH}">the dataset page</a> under CC BY 4.0, so anyone can recompute or extend these figures. How studies enter and are classified is on <a href="/methodology">the methodology page</a>.</p>\n`;
  h += `</article>\n`;
  h += footer(conditions);
  return h;
}
