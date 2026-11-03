// CTR pass 2026-11-02 (Josh: "yes" to the CTR analysis). Titles/descriptions
// matched to the queries each page already ranks for (GSC 90d, pos 4–15, low
// CTR), plus the two "KEEP — refresh with evidence grading" guides from the
// approved hub-consolidation report. Dry-run by default; --apply writes.
//   DATABASE_URL=... NODE_PATH=$PWD/node_modules node scripts/content/apply-ctr-fixes-2026-11-02.cjs [--apply]
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const APPLY = process.argv.includes("--apply");
const DISCLOSURE =
  "*Hydrogen Studies is funded by Echo Technologies LLC, which sells hydrogen water products. Echo doesn't decide which studies we cover or how we describe them — see our [editorial policy](/editorial-policy).*";

const BLOG_META = {
  "h2-tabs-side-effects": {
    meta_title: "Hydrogen Tablets: Side Effects, Benefits & Magnesium",
    meta_description:
      "Side effects of hydrogen tablets like H2 Tabs and Vital Reaction: what human trials reported, how much magnesium each tablet adds, and who should be cautious.",
  },
  "hydrogen-water-filter-guide-pillar": {
    meta_title: "Hydrogen Water Filters: How They Work & What to Check",
    meta_description:
      "How hydrogen water filtration systems combine filtering with dissolved hydrogen: countertop vs under-sink, what to check, testing, and running costs.",
  },
  "kangen-water-scam-truth": {
    meta_title: "Is Kangen Water Legit or a Scam? MLM vs the Science",
    meta_description:
      "Is Kangen water legit? Enagic machines do make hydrogen water, but MLM health claims go far beyond the evidence. What studies show, what's hype, and the cost.",
  },
  "kangen-water-review": {
    meta_title: "Kangen Water Review: Pros, Cons & What Science Says",
    meta_description:
      "Kangen water reviewed: what Enagic's ~$4,000 machines make, the disadvantages, and what research says about the health claims made for them.",
  },
  "kangen-water-alternative-pillar": {
    meta_title: "Kangen Water Alternatives & Kangen vs Hydrogen Water",
    meta_description:
      "Kangen ionizers vs hydrogen water bottles and machines: how they differ, hydrogen levels, 5-year costs, and what to check before you switch.",
    og_title: "Kangen Water Alternatives & Kangen vs Hydrogen Water",
  },
  "hydrogen-therapy-machine-home": {
    meta_title: "Hydrogen Machines for Home: Types, Safety & Studies",
    meta_description:
      "What a home hydrogen machine (often sold as a hydrogen therapy machine) does: inhalation vs water machines, flow rates studies used, and safety checks.",
  },
  "hydrogen-water-ppm-levels": {
    meta_title: "Hydrogen Water PPM: Levels, Limits & Label Claims",
    meta_description:
      "What hydrogen ppm means, why water holds only about 1.6 ppm, whether high-ppm label claims hold up, how fast levels drop, and how to check a label.",
  },
  "hydrogen-water-vs-regular-water": {
    meta_title: "Hydrogen Water vs Regular Water: Is There a Difference?",
    meta_description:
      "Hydrogen water is regular water with dissolved hydrogen gas. How it differs, what human trials found (often small or mixed), cost, and if it's worth it.",
  },
};

const SPINE = {
  slug: "how-to-use-hydrogen-water-for-spine-pain-a-science-backed-guide-855883",
  title: "Hydrogen for Back Pain and Sciatica: What Studies Show",
  meta_title: "Hydrogen Tablets for Back Pain & Sciatica: The Evidence",
  meta_description:
    "Do hydrogen tablets or hydrogen water help back pain or sciatica? No trial has tested them. What one small surgical pilot and animal studies found.",
  summary:
    "No trial has tested hydrogen tablets or hydrogen water for back pain or sciatica. One small, non-randomized pilot of hydrogen inhalation around spine surgery and a few animal studies are all the evidence so far.",
  content: `${DISCLOSURE}

**Short answer:** No study has tested hydrogen tablets or hydrogen water for back pain or sciatica. The only human data comes from a small, non-randomized 2026 pilot in which people having spine surgery for a herniated disc breathed hydrogen gas around the operation. They reported less pain afterward, but the study wasn't randomized or blinded, and records for about a third of the hydrogen group were missing [1]. Everything else is animal research [1][2][3]. Hydrogen is not an established treatment for back pain.

## Has hydrogen been tested for back pain or sciatica?

Only once in people, and not with water or tablets. In a pilot study in Taiwan, adults having endoscopic discectomy (surgery for a disc pressing on a nerve, the usual cause of sciatica) were enrolled in two consecutive periods: one group breathed about 4% hydrogen through a nasal cannula around surgery, the other didn't [1].

- 37 patients were enrolled, but records for 12 people in the hydrogen group could not be found when the paper was written, so the analysis covered 25 (13 hydrogen, 12 control) [1].
- The hydrogen group reported lower pain scores on arrival in recovery, at 1 hour and at 1 month, and used less pain medication [1].
- Because patients weren't randomized or blinded and many records were missing, the authors say the results need confirming in randomized trials [1].

## What do animal studies show?

- In mice with leg fractures, injections of hydrogen-rich saline into the abdomen prevented long-lasting pain sensitivity and reduced inflammation markers in the spinal cord [2].
- In the surgical paper above, mice with an injured sciatic nerve that breathed hydrogen daily for 14 days were less sensitive to touch than mice breathing air [1].
- Reviews describe similar results in other animal models of nerve pain [3].

Animal results often don't carry over to people, and these studies used injections or inhalation, not drinking water or tablets.

## Do hydrogen tablets work for back pain?

There is no evidence either way: no trial has given hydrogen tablets or hydrogen water to people with back pain or sciatica. Most tablets are magnesium-based and release hydrogen when dropped in water; our guide to [hydrogen tablet side effects](/blog/h2-tabs-side-effects) covers how much magnesium they add.

## What the evidence doesn't show

- That drinking hydrogen water or taking hydrogen tablets relieves back pain, sciatica or spine pain.
- That hydrogen can replace medical care for back pain. Sudden severe back pain, numbness or weakness in the legs, or loss of bladder or bowel control needs urgent medical attention.

**Evidence grade: very low** — one small non-randomized pilot (inhalation, around surgery) plus animal studies.

## Frequently asked questions

### Can hydrogen water help sciatica?

It hasn't been tested. The only human study gave hydrogen gas by inhalation around spine surgery, not hydrogen water, and it wasn't randomized [1].

### Is hydrogen inhalation used for pain?

Only in research so far. About 4% hydrogen in air is the lower flammability limit, so inhalation should only be done with equipment designed for it and as directed.

## Sources

1. Sung CH, et al. Perioperative hydrogen inhalation and postoperative pain after endoscopic discectomy: a pilot non-randomized clinical study with exploratory murine data. *Medicina*. 2026. [PubMed](https://pubmed.ncbi.nlm.nih.gov/42796391/) · [Our summary](/study/perioperative-hydrogen-inhalation-and-postoperative-pain-after-endoscopic-discectomy-a-pilot-non-randomized-clinical-study-with-exploratory-murine-data-1793389519014)
2. Wang Y, et al. Hydrogen-rich saline attenuates chronic allodynia after bone fractures via reducing spinal CXCL1/CXCR2-mediated iron accumulation in mice. *Brain Sciences*. 2022. [PubMed](https://pubmed.ncbi.nlm.nih.gov/36552070/) · [Our summary](/study/hydrogen-rich-saline-attenuates-chronic-allodynia-after-bone-fractures-via-reducing-spinal-cxcl1cxcr2-mediated-iron-accumulation-in-mice-1775650467168)
3. Chen W, Zhang HT, Qin SC. Neuroprotective effects of molecular hydrogen: a critical review. *Neuroscience Bulletin*. 2020. [PubMed](https://pubmed.ncbi.nlm.nih.gov/33078374/) · [Our summary](/study/neuroprotective-effects-of-molecular-hydrogen-a-critical-review-1777577956385)

*How we wrote this: rewritten on November 2, 2026, replacing an earlier version that turned a mouse study into usage advice and included product promotion. Drafted with AI assistance from the sources above and checked against each source by the Hydrogen Studies editorial team. This is general information, not medical advice.*
`,
};

const BLADDER = {
  slug: "how-to-use-hydrogen-water-for-bladder-control-a-science-backed-guide-082030",
  title: "Does Hydrogen Water Make You Pee More? Bladder Research",
  meta_title: "Does Hydrogen Water Make You Pee More? What Studies Show",
  meta_description:
    "Hydrogen water makes you pee about as much as plain water. The one human bladder trial found no benefit over placebo; the rest is mouse and rat work.",
  summary:
    "Hydrogen water makes you urinate about as much as the same amount of plain water. The only human bladder trial found no benefit over placebo; studies of nighttime urination and bladder overactivity are in mice and rats.",
  content: `${DISCLOSURE}

**Short answer:** Hydrogen water makes you urinate about as much as the same amount of plain water — we found no study showing that the dissolved hydrogen itself increases urine. For bladder conditions, the only human trial, in 30 people with painful bladder syndrome, found hydrogen water worked no better than placebo water over 8 weeks [1]. Studies suggesting hydrogen reduces nighttime urination or bladder overactivity were done in mice and rats [2][3].

## Does hydrogen water make you pee more?

Mostly because it's water. Human drinking trials usually gave about 0.5 to 1.5 liters a day, and drinking extra fluid of any kind increases urine output. We found no human study that measured whether the dissolved hydrogen changes how much you urinate.

## Is it OK to drink hydrogen water before bed?

Nothing suggests hydrogen water behaves differently from plain water at night. If you wake up to urinate, cutting back on fluids in the couple of hours before bed is a common recommendation — that applies to hydrogen water too.

## What did the bladder trial find?

In a randomized, double-blind trial in Japan, 30 adults with interstitial cystitis/painful bladder syndrome drank hydrogen-rich water or placebo water for 8 weeks [1]. Bladder pain improved in both groups, with no significant difference between them. The authors concluded the results don't support hydrogen-rich water for this condition [1].

## What do animal studies show?

- In mice with excess nighttime urine production, a silicon-based agent designed to release hydrogen reduced oxidative stress in the kidneys and reduced urine during the rest period [2].
- In rats with surgically blocked bladder outflow, drinking hydrogen water for 4 weeks reduced signs of bladder overactivity and oxidative stress [3].

These are animal models of specific conditions. They don't show that hydrogen water reduces nighttime urination, urgency or leakage in people.

## What the evidence doesn't show

- That hydrogen water reduces nighttime bathroom trips in people.
- That it treats overactive bladder, interstitial cystitis or kidney disease. For kidney research, see [hydrogen water and kidneys](/explore-by-condition/kidney-health).

**Evidence grade: very low** for any bladder benefit — the one human trial found no difference from placebo.

## Frequently asked questions

### Is hydrogen water a diuretic?

There's no evidence that it is. It increases urine about as much as the same volume of plain water.

### Can hydrogen water help overactive bladder?

It hasn't been tested in people with overactive bladder. The rat study [3] is the closest evidence, and the one human bladder trial, in a different condition, was negative [1].

## Sources

1. Matsumoto S, Ueda T, Kakizaki H. Effect of supplementation with hydrogen-rich water in patients with interstitial cystitis/painful bladder syndrome. *Urology*. 2013. [PubMed](https://pubmed.ncbi.nlm.nih.gov/23374763/) · [Our summary](/study/effect-of-supplementation-with-hydrogen-rich-water-in-patients-with-interstitial-cystitispainful-bladder-syndrome-1775650467154)
2. Sekii Y, et al. Oxidative stress-induced NCC activation in the development of nocturnal polyuria in mice: therapeutic potential of a sustained hydrogen-releasing silicon-based agent. *Biochemistry and Biophysics Reports*. 2025. [PubMed](https://pubmed.ncbi.nlm.nih.gov/39896112/) · [Our summary](/study/oxidative-stress-induced-ncc-activation-in-the-development-of-nocturnal-polyuria-in-mice-therapeutic-potential-of-a-sustained-hydrogen-releasing-silicon-based-agent-1775650467176)
3. Miyazaki N, et al. Preventive effect of hydrogen water on the development of detrusor overactivity in a rat model of bladder outlet obstruction. *Journal of Urology*. 2016. [PubMed](https://pubmed.ncbi.nlm.nih.gov/26518110/) · [Our summary](/study/preventive-effect-of-hydrogen-water-on-the-development-of-detrusor-overactivity-in-a-rat-model-of-bladder-outlet-obstruction-1775650467147)

*How we wrote this: rewritten on November 2, 2026, replacing an earlier version that turned a mouse study into usage advice and included product promotion. Drafted with AI assistance from the sources above and checked against each source by the Hydrogen Studies editorial team. This is general information, not medical advice.*
`,
};

const STUDY_META = {
  "29512923": {
    meta_title: "Hydrogen Water for Acid Reflux (GERD): Study Results",
    meta_description:
      "In 84 people with GERD on PPI treatment, adding hydrogen-rich electrolyzed water for 3 months was linked to better symptoms and oxidative-stress markers.",
  },
  "22560529": {
    meta_title: "Hydrogen Water and Blood pH: Mayo Clinic Proceedings Letter",
    meta_description:
      "A 2012 letter in the journal Mayo Clinic Proceedings reported slightly more alkaline blood in men drinking hydrogen water. Uncontrolled; not Mayo Clinic work.",
    plain_summary:
      "A short research letter by Sergej Ostojic, published in the journal Mayo Clinic Proceedings in 2012 (it was not a Mayo Clinic study), reported that healthy men who drank hydrogen-rich water had slightly more alkaline blood. There was no control group, so the change can't be attributed to the hydrogen. It doesn't show any health benefit.",
  },
};

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const slugs = [...Object.keys(BLOG_META), SPINE.slug, BLADDER.slug];
  const { rows: blogs } = await db.query("select * from blog_articles where slug = any($1)", [slugs]);
  const { rows: studies } = await db.query(
    "select id, pmid, slug, meta_title, meta_description, plain_summary from studies where pmid = any($1)",
    [Object.keys(STUDY_META)],
  );
  if (blogs.length !== slugs.length) throw new Error(`expected ${slugs.length} posts, found ${blogs.length}`);
  if (studies.length !== Object.keys(STUDY_META).length) throw new Error("study count mismatch");

  for (const b of blogs) {
    const m = BLOG_META[b.slug] || [SPINE, BLADDER].find((x) => x.slug === b.slug);
    console.log(`${b.slug}\n  title: ${b.meta_title} → ${m.meta_title}\n  desc:  ${m.meta_description.length}c`);
  }
  for (const s of studies) console.log(`study ${s.pmid}: ${s.meta_title} → ${STUDY_META[s.pmid].meta_title}`);
  if (!APPLY) return db.end().then(() => console.log("\nDry run. --apply to write."));

  const dir = path.join("reports", "backups");
  fs.mkdirSync(dir, { recursive: true });
  const backup = path.join(dir, `ctr-fixes-${Date.now()}.json`);
  fs.writeFileSync(backup, JSON.stringify({ blogs, studies }, null, 2));
  console.log(`backup → ${backup}`);

  await db.query("begin");
  for (const [slug, m] of Object.entries(BLOG_META)) {
    await db.query(
      `update blog_articles set meta_title=$2, meta_description=$3, og_title=coalesce($4, og_title), og_description=$3, updated_at=now() where slug=$1`,
      [slug, m.meta_title, m.meta_description, m.og_title || null],
    );
  }
  for (const p of [SPINE, BLADDER]) {
    await db.query(
      `update blog_articles set title=$2, meta_title=$3, meta_description=$4, og_title=$2, og_description=$4,
         twitter_title=$2, twitter_description=$4, summary=$5, summary_50_words=$5, summary_100_words=$5,
         content=$6, faq_schema=null, question_answer_pairs=null, author_name='Hydrogen Studies Editorial Team',
         last_reviewed=now(), updated_at=now() where slug=$1`,
      [p.slug, p.title, p.meta_title, p.meta_description, p.summary, p.content],
    );
  }
  for (const [pmid, m] of Object.entries(STUDY_META)) {
    await db.query(
      `update studies set meta_title=$2, meta_description=$3, plain_summary=coalesce($4, plain_summary), last_modified=now() where pmid=$1`,
      [pmid, m.meta_title, m.meta_description, m.plain_summary || null],
    );
  }
  await db.query("commit");
  await db.end();
  console.log("applied");
})().catch((e) => { console.error(e); process.exit(1); });
