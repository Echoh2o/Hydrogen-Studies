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
  SCAM_FAQS,
  SCAM_H1,
  SCAM_LAST_REVIEWED,
  SCAM_PATH,
  GAP_MAP_H1,
  GAP_MAP_LAST_REVIEWED,
  GAP_MAP_MIN_STUDIES,
  GAP_MAP_PATH,
  fmtInt,
  gapBucket,
  pct,
} from "../../shared/evidence-pages";
import { DATASET_PATH } from "../../shared/dataset";
import { CONDITION_HUB_INTROS, getConditionHubIntro, type EvidenceGrade } from "../../shared/condition-hub-intros";
import { conditionHubForValue, exploreHubPath, titleCaseSlug } from "../../shared/explore-hubs";
import { getEvidenceStats, getGapMatrix, getNonPositiveStudies, type EvidenceStats, type GapRow } from "../services/evidence-stats";
import { getConditionHubs, getTopConditions, renderBylineHtml } from "./seo-body-renderer";
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
  h += `<li>If your question is simply whether hydrogen water is a scam, <a href="${SCAM_PATH}">here is our answer</a>.</li>`;
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

const GRADE_LABEL: Record<EvidenceGrade, string> = { "very low": "Very low", low: "Low", moderate: "Moderate", high: "High" };

export async function renderScamPage(): Promise<string> {
  const [s, conditions, hubs] = await Promise.all([getEvidenceStats(), getTopConditions(), getConditionHubs()]);
  const rct = s.designs.find((d) => d.design === "rct")?.n ?? 0;
  const o = s.outcomes;
  const nonPositive = o.neutral + o.negative + o.mixed;
  const ht = s.humanTrials;
  const asOf = formatLongDate(s.asOf);
  const intros = Object.values(CONDITION_HUB_INTROS);
  const hubName = (slug: string) => hubs.find((h) => h.slug === slug)?.name ?? titleCaseSlug(slug);
  const grades = intros.map((r) => r.evidenceGrade);
  const bestGrade = grades.includes("high") ? "high" : grades.includes("moderate") ? "moderate" : grades.includes("low") ? "low" : "very low";

  let h = breadcrumbs(pageBreadcrumbs(SCAM_H1));
  h += `<article>\n<h1>${esc(SCAM_H1)}</h1>\n`;
  h += renderBylineHtml(blogByline({ authorName: EDITORIAL_TEAM, updatedAt: SCAM_LAST_REVIEWED }));
  h += `<p class="lead"><strong>Short answer:</strong> hydrogen water is not a scam in the sense of a made-up product with no science behind it. Molecular hydrogen is a real molecule, trials measure it in people's breath and blood after they drink it, and it has been studied in ${fmtInt(s.total)} papers, ${fmtInt(s.human)} of them in people. But much of the marketing runs far ahead of that evidence. No human trial has shown that hydrogen water treats, cures or prevents any disease, most trials are small and short, and the published results lean positive in a way that says more about publishing than about hydrogen. This page, written by a site that is funded by a hydrogen water company, sets out what is real, what is oversold, and how to tell the difference.</p>\n`;

  h += `<h2 id="what-is-real">What is real</h2>\n`;
  h += `<ul>`;
  h += `<li><strong>The molecule and the dose are real.</strong> Hydrogen gas dissolves in water, is absorbed when you drink it, and appears in exhaled breath within minutes; trials in this database measure that directly.</li>`;
  h += `<li><strong>It is well tolerated at the doses studied.</strong> Human trials report mild effects at most, such as loose stools or bloating, mostly with magnesium-based tablets. Long-term safety has not been studied.</li>`;
  h += `<li><strong>Some trials find effects beyond placebo</strong> on specific measures, such as blood markers of oxidative stress, how tired people feel after exercise, or some metabolic markers; others find none. The effects reported are modest and inconsistent between trials.</li>`;
  h += `<li><strong>The research is young and growing.</strong> ${pct(s.since2010, s.total)} of the studies here were published since 2010.</li>`;
  h += `</ul>\n`;

  h += `<h2 id="what-is-oversold">What is oversold</h2>\n`;
  h += `<ul>`;
  h += `<li><strong>Disease claims.</strong> Hydrogen water is not an approved treatment for any disease. Of ${fmtInt(s.human)} human studies, ${fmtInt(rct)} are randomized controlled trials, and none shows that drinking hydrogen water treats, cures or prevents a disease; the trials in diagnosed patients measured blood markers over weeks or months. Inhaled hydrogen gas has been studied in hospitals, for example under Japan's advanced-medical-care program for patients after cardiac arrest, but that is a different route, dose and setting from a bottle of water.</li>`;
  h += `<li><strong>"Thousands of studies."</strong> Our own home page says 2,000+ studies, and this page exists to say what that number is worth: ${fmtInt(s.human)} studies in people (${pct(s.human, s.total)}), with a median of ${ht.medianN == null ? "about twenty" : fmtInt(Math.round(ht.medianN))} participants and a median length of ${ht.medianDays == null ? "a few weeks" : `${fmtInt(Math.round(ht.medianDays))} days`}. The rest is animal and laboratory work and reviews. Details on <a href="${LIMITS_PATH}">the limits of the evidence</a>.</li>`;
  h += `<li><strong>The positive-result skew.</strong> ${pct(o.positive, o.withOutcome)} of the ${fmtInt(o.withOutcome)} studies with a recorded outcome direction are positive. Nobody's intervention works ${pct(o.positive, o.withOutcome)} of the time; null results are less likely to be published. We list the ${fmtInt(nonPositive)} <a href="${NULL_RESULTS_PATH}">null and negative results</a> rather than hide them.</li>`;
  h += `<li><strong>Alkaline, ionized, "structured" or "detox" water.</strong> Hydrogen content has nothing to do with pH or any of those labels. A product sold on those words is not selling you hydrogen evidence.</li>`;
  h += `<li><strong>Concentration claims.</strong> Dissolved hydrogen escapes from water quickly, especially in an open glass, so what matters is the concentration at the moment you drink, measured by someone other than the seller. We have not tested devices ourselves; a published measurement dataset is planned. Until then, treat concentration figures without third-party measurement as unverified.</li>`;
  h += `<li><strong>Testimonials and "doctor approved."</strong> Neither is evidence. Ask for the trial: how many people, how long, against what placebo, and who paid.</li>`;
  h += `</ul>\n`;

  h += `<h2 id="topic-by-topic">What the evidence supports, topic by topic</h2>\n`;
  h += `<p>Our condition hubs grade the human evidence for each use in GRADE-style terms. Today the strongest grade on any topic is "${GRADE_LABEL[bestGrade]}". "Low" means further research is likely to change the estimate; "Very low" means the true effect is probably substantially different from what the trials suggest. No topic currently rates "Moderate" or "High".</p>\n`;
  h += `<ul>`;
  for (const r of intros) {
    h += `<li><a href="${esc(exploreHubPath("condition", r.slug))}">${esc(hubName(r.slug))}</a>: evidence ${esc(GRADE_LABEL[r.evidenceGrade])}</li>`;
  }
  h += `</ul>\n`;

  h += `<h2 id="red-flags">How to spot a hydrogen claim that outruns the evidence</h2>\n`;
  h += `<ul>`;
  h += `<li>It names a disease it treats, cures or prevents.</li>`;
  h += `<li>It cites "studies" without saying how many were in people, how many people, or for how long.</li>`;
  h += `<li>It leans on words like alkaline, ionized, structured, detox or anti-aging.</li>`;
  h += `<li>It quotes a hydrogen concentration with no independent measurement at drinking time.</li>`;
  h += `<li>It uses testimonials, celebrity or "doctor approved" labels in place of a named trial.</li>`;
  h += `<li>It does not say who funded the research it cites. (Funding is recorded for only ${fmtInt(s.coverage.funding)} studies in this database so far, so often nobody knows.)</li>`;
  h += `</ul>\n`;

  h += `<h2 id="our-conflict">Our conflict of interest</h2>\n`;
  h += `<p>Hydrogen Studies is owned and funded by Echo Technologies LLC, which sells hydrogen water products. That is a reason to read this page skeptically, and it is the reason the page exists in this form: our <a href="/editorial-policy">editorial policy</a> commits us to listing null and negative results on the same footing as positive ones, keeping product content off disease pages, and never describing hydrogen as a treatment. This page recommends no product.</p>\n`;

  h += `<h2 id="bottom-line">The bottom line</h2>\n`;
  h += `<p>Hydrogen water is a real, low-risk intervention with early, mixed, mostly small-trial evidence of modest effects on some blood markers and symptom scores. It is not a treatment for any disease, and anyone promising that is overselling it. Whether it is worth your money is a judgment about a small and uncertain benefit, and the honest way to make it is to read the trials for the use you care about, which is what the hubs above are for.</p>\n`;

  h += `<section aria-labelledby="faq"><h2 id="faq">Frequently asked questions</h2>\n`;
  for (const f of SCAM_FAQS) h += `<h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p>\n`;
  h += `</section>\n`;
  h += `<p class="note">Figures on this page are recomputed from the database when the page is built (as of ${esc(asOf)}); the text was last reviewed on ${esc(formatLongDate(SCAM_LAST_REVIEWED))}. Corrections: <a href="/contact">contact us</a>.</p>\n`;
  h += `</article>\n`;
  h += footer(conditions);
  return h;
}

// ── Evidence gap map (PLAN 6.3) ───────────────────────────────────

const BUCKET_STYLE: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "background:#f8fafc;color:#94a3b8",
  1: "background:#ccfbf1",
  2: "background:#5eead4",
  3: "background:#14b8a6;color:#fff",
  4: "background:#0f766e;color:#fff",
};

const GAP_COLUMNS: { key: keyof GapRow; label: string; abbr: string }[] = [
  { key: "sr", label: "Systematic reviews / meta-analyses", abbr: "SR/MA" },
  { key: "rct", label: "Randomized controlled trials", abbr: "RCT" },
  { key: "otherHuman", label: "Other human studies", abbr: "Other human" },
  { key: "animal", label: "Animal studies", abbr: "Animal" },
  { key: "inVitro", label: "Laboratory studies", abbr: "Lab" },
  { key: "review", label: "Reviews and commentaries", abbr: "Review" },
];

function cell(n: number): string {
  const b = gapBucket(n);
  return `<td data-level="${b}" style="${BUCKET_STYLE[b]};text-align:right">${n ? fmtInt(n) : "–"}</td>`;
}

/**
 * The matrix itself — shared by the page and the embeddable fragment. Rows
 * link to the condition hub when one exists; "certainty" is the hub's
 * reviewed evidence grade, or "not graded" when no intro has been written.
 */
export async function renderGapMapTable(): Promise<{ html: string; rows: GapRow[]; asOf: Date }> {
  const [rows, hubs] = await Promise.all([getGapMatrix(GAP_MAP_MIN_STUDIES), getConditionHubs()]);
  let h = `<table class="gap-map"><thead><tr><th scope="col">Condition tag</th><th scope="col">All</th>`;
  for (const c of GAP_COLUMNS) h += `<th scope="col" title="${esc(c.label)}">${esc(c.abbr)}</th>`;
  h += `<th scope="col" title="Human studies with a positive recorded result / with a neutral, negative or mixed result">Human results +/−</th><th scope="col">Certainty</th></tr></thead><tbody>`;
  for (const r of rows) {
    const hub = conditionHubForValue(r.condition, hubs);
    const intro = hub ? getConditionHubIntro(hub.slug) : null;
    const label = hub ? `<a href="${esc(exploreHubPath("condition", hub.slug))}">${esc(hub.name || r.condition)}</a>` : esc(r.condition);
    h += `<tr><th scope="row">${label}</th><td style="text-align:right">${fmtInt(r.total)}</td>`;
    for (const c of GAP_COLUMNS) h += cell(Number(r[c.key]));
    const human = r.humanPositive + r.humanNonPositive;
    h += `<td style="text-align:right">${human ? `${fmtInt(r.humanPositive)} / ${fmtInt(r.humanNonPositive)}` : "–"}</td>`;
    h += `<td>${intro ? `<a href="${esc(exploreHubPath("condition", intro.slug))}">${esc(GRADE_LABEL[intro.evidenceGrade])}</a>` : "not graded"}</td></tr>`;
  }
  h += `</tbody></table>\n`;
  return { html: h, rows, asOf: new Date() };
}

export async function renderGapMapPage(): Promise<string> {
  const [{ html: table, rows, asOf }, conditions] = await Promise.all([renderGapMapTable(), getTopConditions()]);
  const noHuman = rows.filter((r) => r.sr + r.rct + r.otherHuman === 0);
  const animalHeavy = noHuman.filter((r) => r.animal >= 20).sort((a, b) => b.animal - a.animal);
  const rctRows = rows.filter((r) => r.rct > 0);
  let h = breadcrumbs(pageBreadcrumbs(GAP_MAP_H1));
  h += `<article>\n<h1>${esc(GAP_MAP_H1)}</h1>\n`;
  h += renderBylineHtml(blogByline({ authorName: EDITORIAL_TEAM, updatedAt: GAP_MAP_LAST_REVIEWED }));
  h += `<p class="lead">One table: every health-condition tag with at least ${GAP_MAP_MIN_STUDIES} studies in the database (${fmtInt(rows.length)} tags), by the kind of evidence behind it, from systematic reviews down to reviews that report no new data. Darker cells hold more studies. The last two columns show how the human studies came out and, where we have written a reviewed hub introduction, how certain the evidence is. Figures as of ${esc(formatLongDate(asOf))}; the prose was last reviewed on ${esc(formatLongDate(GAP_MAP_LAST_REVIEWED))}.</p>\n`;

  h += `<h2 id="how-to-read">How to read it</h2>\n`;
  h += `<ul>`;
  h += `<li>A row with many animal and laboratory studies and nothing in the SR/MA, RCT or other-human columns is a gap: a topic where no one has yet tested hydrogen in people.</li>`;
  h += `<li>A row whose human studies sit in the "other human" column has been studied in people, but without randomization; those studies cannot show cause and effect.</li>`;
  h += `<li>"Human results +/−" counts human studies with a positive recorded result against those with a neutral, negative or mixed one. A high positive share with few studies says more about publishing than about hydrogen — see <a href="${LIMITS_PATH}">the limits of the evidence</a>.</li>`;
  h += `<li>"Certainty" is the GRADE-style grade from the hub introduction, where one exists; "not graded" means no reviewed introduction has been written for that tag yet.</li>`;
  h += `<li>Tags are assigned per study and a study can carry several, so rows overlap; columns within a row do not.</li>`;
  h += `</ul>\n`;

  h += `<h2 id="biggest-gaps">The biggest gaps</h2>\n`;
  if (animalHeavy.length) {
    h += `<p>${fmtInt(noHuman.length)} of the ${fmtInt(rows.length)} tags have no human study at all. The ones with the most animal work and still nothing in people:</p>\n<ul>`;
    for (const r of animalHeavy.slice(0, 10)) h += `<li>${esc(r.condition)}: ${fmtInt(r.animal)} animal studies, 0 in people</li>`;
    h += `</ul>\n`;
  } else {
    h += `<p>${fmtInt(noHuman.length)} of the ${fmtInt(rows.length)} tags have no human study at all.</p>\n`;
  }
  const twoPlus = rctRows.filter((r) => r.rct >= 2).length;
  h += `<p>${fmtInt(rctRows.length)} ${rctRows.length === 1 ? "tag has" : "tags have"} at least one randomized controlled trial; ${fmtInt(twoPlus)} ${twoPlus === 1 ? "has" : "have"} two or more.</p>\n`;

  h += `<h2 id="map">The map</h2>\n`;
  h += `<p class="legend">Shading: <span style="${BUCKET_STYLE[1]};padding:0 .4em">1–2</span> <span style="${BUCKET_STYLE[2]};padding:0 .4em">3–9</span> <span style="${BUCKET_STYLE[3]};padding:0 .4em">10–29</span> <span style="${BUCKET_STYLE[4]};padding:0 .4em">30+</span> studies.</p>\n`;
  h += table;

  h += `<h2 id="reuse">Reuse</h2>\n`;
  h += `<p>The table is built from <a href="${DATASET_PATH}">the open dataset</a> (CC BY 4.0) each time the page is built, so anyone can recompute or extend it. An embeddable version of the table is at <code>${GAP_MAP_PATH}/embed</code>; it carries a link back here. Design classes and tags are machine-drafted and audited (<a href="/methodology">methodology</a>); report a misclassified study via <a href="/contact">contact</a>.</p>\n`;
  h += `</article>\n`;
  h += footer(conditions);
  return h;
}

/** Standalone, script-free HTML document for an <iframe> on another site. */
export async function renderGapMapEmbed(): Promise<string> {
  const { html, asOf } = await renderGapMapTable();
  const site = "https://hydrogenstudies.com";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Evidence gap map — Hydrogen Studies</title>
<style>body{font:14px/1.4 system-ui,sans-serif;margin:0;padding:12px;color:#0f172a}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e2e8f0;padding:4px 6px;font-size:13px}th{background:#f1f5f9;text-align:left}a{color:#0f766e}.src{margin-top:8px;font-size:12px;color:#475569}</style></head><body>
${html.replace(/href="\//g, `href="${site}/`)}
<p class="src">Evidence gap map by <a href="${site}${GAP_MAP_PATH}">Hydrogen Studies</a> (funded by Echo Technologies LLC), from the <a href="${site}${DATASET_PATH}">open dataset</a>, CC BY 4.0. Figures as of ${esc(formatLongDate(asOf))}.</p>
</body></html>`;
}
