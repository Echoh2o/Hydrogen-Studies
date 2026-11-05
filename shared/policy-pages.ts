/**
 * /editorial-policy and /methodology — PLAN.md 4.2 (three real pages, ≥600
 * words each; /about is client/src/pages/content/AboutContent.tsx).
 *
 * ONE source for the page renderer (seo-body-renderer renderPolicyPage → the
 * Next front door) and the SPA pages, so every visitor reads the same text.
 * Sections are markdown (links as [text](href)); headings are added by the
 * renderer as <h2>, so the markdown must not contain headings of its own.
 *
 * Every factual claim here describes what the code actually does
 * (server/services/job-scheduler.ts cadences, study-topic-guard screening,
 * excluded-studies 410s, shared/study-page.ts evidence labels) or a dated
 * count from the database. Counts carry "as of <month year>" — update them
 * when you update `lastUpdated`.
 */
export interface PolicySection {
  heading: string;
  markdown: string;
}

export interface PolicyPage {
  path: "/editorial-policy" | "/methodology";
  h1: string;
  /** Visible "Last updated" date (ISO), also the schema dateModified. */
  lastUpdated: string;
  intro: string;
  sections: PolicySection[];
}

export const EDITORIAL_POLICY: PolicyPage = {
  path: "/editorial-policy",
  h1: "Editorial Policy",
  lastUpdated: "2026-11-05",
  intro:
    "Hydrogen Studies is a research database about molecular hydrogen that is owned and funded by a company that sells hydrogen water products. This page says who runs it, what the funder can and cannot do, how pages are written and checked, and how to get something corrected.",
  sections: [
    {
      heading: "Who runs this site",
      markdown:
        "Hydrogen Studies is published by Echo Technologies LLC, the company behind Echo Water hydrogen products. A small editorial and engineering team at Echo builds and maintains it. We say this plainly, on every page, because a database of hydrogen research run by a hydrogen company is only worth reading if the sponsorship is visible and the rules below are kept.",
    },
    {
      heading: "Who funds it, and what the funding does not buy",
      markdown:
        "Echo pays for the hosting, the data sources, the drafting tools and the editorial time. Echo does not choose which studies appear, does not edit how a study is described, and does not remove studies whose results are unfavorable to hydrogen products. Studies enter the database by a mechanical rule (a search of the medical literature plus a topic screen, described on the [methodology page](/methodology)), not by anyone's choice. Null and negative results are listed on the same basis as positive ones. When a study's funding or conflicts of interest are recorded, industry funding is shown as such, including any study funded by Echo Technologies.",
    },
    {
      heading: "What we publish",
      markdown:
        "- **Study pages**, one per paper: the original title, authors, journal, year, DOI and PubMed ID; a plain-language headline and summary written by us; the evidence type (randomized trial, animal study, laboratory study, review and so on); and a short excerpt of the abstract with a link to the paper. We never republish a full abstract, because abstracts belong to their publishers.\n- **Condition and topic hubs**, which open with an evidence-graded introduction written from the primary papers, with numbered sources, followed by the studies on that topic.\n- **A small number of guides.** In September 2026 we retired 3,109 thin or duplicative articles that an earlier content pipeline had produced; as of November 2026 the site carries about 30 guides, each planned and reviewed before publication. We do not generate articles automatically.\n- **The Learn section**, a plain-English explainer of what hydrogen is and what the research does and does not show.",
    },
    {
      heading: "What we do not publish",
      markdown:
        "Nothing on this site is medical advice. We do not tell readers to use hydrogen for any condition, and we do not describe hydrogen as a treatment, cure or prevention for any disease. Product information appears only in clearly labeled sponsor modules, only on pages whose primary topic is on a fixed list of non-disease topics (for example exercise recovery or hydration), and never inside a study summary or on a page about a diagnosed medical condition. Links to echowater.com are tagged as sponsored links.",
    },
    {
      heading: "How pages are drafted: AI assistance",
      markdown:
        "The plain-language headline, the summary, the key finding and the structured details on a study page are first drafted by large language models (currently Anthropic's Claude models, with OpenAI as a fallback) from the paper's abstract or full text. We are transparent about this because a machine draft is only a starting point: it can misstate what a study measured, overstate a result, or miss a limitation. Every machine-drafted page links its primary source so a reader can check it against the paper.",
    },
    {
      heading: "How pages are checked",
      markdown:
        "Every study is reviewed by a person before it is published. A newly found paper waits in a review queue after the AI drafting steps; it goes live only when our reviewer, Sarah Taylor-Laine, has checked the summary and the extracted details against the paper and approved it. She has also reviewed every study already in the database. Each study page names her as reviewer.\n\nWe also run audits across the whole database: in November 2026 every one of the 2,305 study headlines was checked against what the study actually measured, 674 were rewritten, and 515 extracted field values (sample sizes, durations, concentrations) were corrected or removed. Pages are corrected whenever a reader or a researcher reports a problem. Hub introductions and guides are written by the editorial team from the primary papers and checked against the studies they cite before they are published.\n\nWe do not yet record a review date for each study, so study pages show the date the page was last updated rather than a review date. Even a reviewed summary is a short reading of the paper; rely on the linked paper for anything that matters.",
    },
    {
      heading: "Our scientific reviewer",
      markdown:
        "Sarah Taylor-Laine (B.Sc. and M.Sc. in Biology, California State University) is Research Director at Echo Water, the company that funds this site; she works with Echo as a contractor. She is a founding board member of the American Hydrogen Health Association (AHHA). Her career spans academic and applied research, product development, regulatory consulting and scientific communication.\n\nBecause she works for our funder, her review is not independent of Echo, and we do not describe it that way. What it does mean: a named person with a biology background has checked each study page against the paper before it is published. The [methodology](/methodology) describes what is checked.",
    },
    {
      heading: "Corrections and retractions",
      markdown:
        "If something on a page is wrong, [tell us](/contact). We check the claim against the primary source, fix the page, and the \"Updated\" date on the page changes. Researchers whose work we summarize can ask us to correct a summary or to shorten or remove the abstract excerpt.\n\nWe check the database against retraction and correction notices once a day. Papers that have been retracted or carry an expression of concern are removed from the live database and their pages return a \"410 Gone\" status rather than a redirect, so search engines drop them. As of November 2026, 38 papers have been removed this way. When a correction changes what a hub introduction says, we note the correction in the text next to the affected source.",
    },
    {
      heading: "How often things change",
      markdown:
        "New papers are discovered from PubMed, Europe PMC and CrossRef every six hours. Retraction checks run daily. Hub introductions are updated when new evidence lands on their topic, and each shows its own \"Updated\" date. This policy is reviewed whenever the process it describes changes; its last-updated date is shown at the top of the page.",
    },
    {
      heading: "Contact",
      markdown:
        "Questions, corrections and requests from researchers go through the [contact page](/contact). If you are a journal, author or publisher with a rights concern about an excerpt, say so and we will act on it first.",
    },
  ],
};

export const METHODOLOGY: PolicyPage = {
  path: "/methodology",
  h1: "Methodology",
  lastUpdated: "2026-11-05",
  intro:
    "How studies get into this database, what we exclude, what a study page contains, how we label the strength of evidence, how summaries are drafted and checked, and what the database cannot tell you.",
  sections: [
    {
      heading: "Scope",
      markdown:
        "The database covers published research on molecular hydrogen (H₂) given to living things as an intervention: hydrogen-rich water, inhaled hydrogen gas, hydrogen-rich saline, hydrogen baths, and hydrogen-producing tablets or powders. It includes human studies, animal studies, cell and tissue studies, and reviews. As of November 2026 it holds about 2,300 papers published between 1948 and 2026. It does not cover hydrogen as a fuel or energy carrier, industrial hydrogen, or general oxidative-stress research in which hydrogen was not the intervention.",
    },
    {
      heading: "How studies enter the database",
      markdown:
        "An automated search of PubMed, Europe PMC and CrossRef runs every six hours using a fixed set of hydrogen-therapy search terms. Each result is screened for topic before anything is stored: a filter removes hydrogen-energy and industrial papers, and records are matched on DOI and PubMed ID so a paper appears once. For every paper we store the original title, authors, journal, publication date, DOI and PubMed ID exactly as the source index reports them, and the study page links to that source. Study URLs are permanent once published.",
    },
    {
      heading: "What we exclude, and why",
      markdown:
        "A paper is removed from the live database when it is retracted or carries a publisher's expression of concern, or when review shows it is off topic. Each removal records its reason. As of November 2026, 82 papers have been removed: 38 for retraction or publication notices and 44 for being off topic (general redox research without a hydrogen intervention, hydrogen-energy papers, and industrial fermentation studies). Removed pages return a \"410 Gone\" status so they leave search results rather than redirecting to another page.",
    },
    {
      heading: "What a study page contains",
      markdown:
        "- The original citation: title, authors, journal, year, DOI and PubMed ID, with a link to the paper.\n- A plain-language headline and summary written for a general reader, a short \"key finding\", and where it applies a practical takeaway.\n- An abstract excerpt of at most 300 characters followed by the link to the full abstract on PubMed or at the publisher. We do not republish full abstracts.\n- The evidence type (see below), with a plain warning when the study was done in animals or in a laboratory rather than in people.\n- Structured details where the paper reports them and we have extracted them: study design, sample size, duration, hydrogen concentration and delivery method, funding source and declared conflicts of interest. Coverage of these fields is partial and growing; as of November 2026 sample size is recorded for most human studies but funding and conflict-of-interest fields are recorded for a minority of papers. A field that was not reported is left blank, never guessed.\n- Links to the condition and body-system hubs the study belongs to, and related studies.",
    },
    {
      heading: "How we label the strength of evidence",
      markdown:
        "Every study is classified by design: systematic review or meta-analysis, randomized controlled trial, controlled trial (non-randomized), uncontrolled trial (single-arm or pilot), observational study, case report, review or commentary, animal study, or laboratory study (cells or tissue). The label is shown on the study page. Animal and laboratory studies carry a visible note that results in animals or cells often do not carry over to people.\n\nOnly about one paper in seven is a human study (351 of about 2,300 as of November 2026), and the human studies are mostly small and short: the median trial has 23 participants and lasts about four weeks. Hub introductions therefore grade the overall evidence for a topic in GRADE-style terms, usually \"Low\" or \"Very low\", and say why: small samples, short durations, few replications, differences between trials, and risk of bias. A positive result in a single small trial is reported as exactly that.",
    },
    {
      heading: "How summaries are drafted and checked",
      markdown:
        "Summaries, headlines and structured fields are drafted by large language models (currently Anthropic's Claude models, with OpenAI as a fallback) from the abstract or full text, then reviewed by a person before publication. Our reviewer, [Sarah Taylor-Laine](/editorial-policy#our-scientific-reviewer) (M.Sc. Biology; Research Director at Echo Water), checks each study's summary and extracted details against the paper and approves it from a review queue; new studies are not published until she does. Database-wide audits add a second check: in November 2026 all 2,305 headlines were audited and 674 rewritten, and extracted field values were spot-checked against the papers before being applied. Individual pages are corrected whenever a reader or researcher reports a problem. The [editorial policy](/editorial-policy) describes the review process and how to request a correction.",
    },
    {
      heading: "How hubs and guides are written",
      markdown:
        "A hub introduction is written by the editorial team from the primary papers on that topic. It states what the human evidence shows, what animal data suggests, the doses and durations that were studied, and the open questions, with numbered citations that link to PubMed and to our study pages. Each hub shows an evidence grade and an \"Updated\" date. FAQ answers on a hub are checked against the cited studies. Guides are planned one at a time and reviewed before publication; nothing is generated in bulk.",
    },
    {
      heading: "Funding and conflicts of interest",
      markdown:
        "Hydrogen Studies is funded by Echo Technologies LLC, a maker of hydrogen water products. Where a paper reports its funding source or the authors' conflicts of interest, we record them as structured fields and show industry funding as such, including any study funded by Echo Technologies. This extraction is in progress; as of November 2026 these two fields are populated for a minority of papers, so a blank field means \"not yet recorded\", not \"no conflict\".",
    },
    {
      heading: "What the database cannot tell you",
      markdown:
        "- **The literature leans positive.** Of the papers with a recorded outcome direction, about 94% report a positive result and about 6% report a neutral, mixed or negative one (November 2026). That reflects what gets published, not a verdict on hydrogen; small positive studies are more likely to be written up than null ones.\n- **It is geographically concentrated.** About 48% of the papers come from China and about 23% from Japan; the United States accounts for about 5%.\n- **Human trials are small and short**, as described above, and few have been replicated independently.\n- **Summaries are machine-drafted** and can be wrong in ways an audit has not yet caught. The linked paper is the source of record.\n- **Citation counts** come from OpenAlex, are shown with their refresh date, and are not a measure of quality.\n\nThe current figures behind each of these points are computed live on [the limits of the evidence](/limits-of-the-evidence); the studies that found nothing are listed under [null and negative results](/null-and-negative-results).",
    },
    {
      heading: "Changes to this methodology",
      markdown:
        "This page is updated when the process changes; its last-updated date is shown at the top. Questions about the method, or requests for the underlying data, go through the [contact page](/contact).",
    },
  ],
};

export const POLICY_PAGES: Record<PolicyPage["path"], PolicyPage> = {
  "/editorial-policy": EDITORIAL_POLICY,
  "/methodology": METHODOLOGY,
};

/** Rough word count of a page's visible prose (intro + sections). */
export function policyPageWordCount(page: PolicyPage): number {
  const text = [page.intro, ...page.sections.flatMap((s) => [s.heading, s.markdown])].join(" ");
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").split(/\s+/).filter(Boolean).length;
}
