/**
 * Study-page content shared by the crawler renderer (seo-body-renderer.ts)
 * and the SPA (SEOStudyPage.tsx) so both show the same hub links, breadcrumb
 * trail and evidence label — and the JSON-LD built from them (seo-markup.ts)
 * only describes what is visible.
 */
import {
  bodySystemHubForValue,
  bodySystemHubName,
  conditionHubForValue,
  exploreHubPath,
  type ConditionHubRef,
} from "./explore-hubs";
import { classifySubject, isStudyDesign, type StudyDesign } from "./research-vocab";

export interface HubLink {
  label: string;
  href: string;
}

const MAX_CONDITION_HUBS = 3;
const MAX_BODY_SYSTEM_HUBS = 2;

/**
 * The topic hubs a study belongs to — condition hubs first, then body-system
 * hubs. Only values that resolve to a real hub are returned (a long-tail
 * value with no hub would be a 404 link), deduplicated by href.
 */
export function studyHubLinks(
  study: { healthConditions?: readonly string[] | null; bodySystems?: readonly string[] | null },
  conditionHubs: readonly ConditionHubRef[],
): HubLink[] {
  const links: HubLink[] = [];
  const seen = new Set<string>();
  const add = (label: string, href: string) => {
    if (seen.has(href)) return;
    seen.add(href);
    links.push({ label, href });
  };

  let conditions = 0;
  for (const value of study.healthConditions ?? []) {
    if (conditions >= MAX_CONDITION_HUBS) break;
    const hub = conditionHubForValue(value, conditionHubs);
    if (!hub) continue;
    const before = links.length;
    add(hub.name || value.trim(), exploreHubPath("condition", hub.slug));
    if (links.length > before) conditions++;
  }

  let systems = 0;
  for (const value of study.bodySystems ?? []) {
    if (systems >= MAX_BODY_SYSTEM_HUBS) break;
    const hub = bodySystemHubForValue(value);
    if (!hub) continue;
    const before = links.length;
    add(bodySystemHubName(hub.slug), exploreHubPath("body-system", hub.slug));
    if (links.length > before) systems++;
  }
  return links;
}

/**
 * Visible breadcrumb trail: Home › Studies › (first hub) › page. The last
 * crumb has no href. Same trail in both renderers and in BreadcrumbList.
 */
export function studyBreadcrumbs(pageLabel: string, hubLinks: readonly HubLink[]): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [
    { label: "Home", href: "/" },
    { label: "Studies", href: "/studies" },
  ];
  if (hubLinks[0]) crumbs.push({ label: hubLinks[0].label, href: hubLinks[0].href });
  crumbs.push({ label: pageLabel });
  return crumbs;
}

const DESIGN_LABELS: Record<StudyDesign, string> = {
  rct: "Randomized controlled trial",
  controlled_trial: "Controlled trial (non-randomized)",
  uncontrolled_trial: "Uncontrolled trial (single-arm or pilot)",
  observational: "Observational study",
  case_report: "Case report or series",
  meta_analysis: "Systematic review or meta-analysis",
  review: "Review or commentary",
  animal: "Animal study",
  in_vitro: "Laboratory study (cells or tissue)",
  other: "",
};

export interface StudyEvidence {
  /** e.g. "Randomized controlled trial · Human study". */
  label: string;
  /** Plain-language caveat for non-human evidence, or null. */
  note: string | null;
}

/**
 * Visible evidence label for a study, from the extracted study_design (and
 * study_type species for animal work). Null when the design is unknown —
 * never guess.
 */
export function studyEvidence(study: {
  studyDesign?: string | null;
  studyType?: string | null;
  isHumanTrial?: boolean | null;
}): StudyEvidence | null {
  const design = isStudyDesign(study.studyDesign) ? study.studyDesign : null;
  const subject = classifySubject(study);
  let label = design ? DESIGN_LABELS[design] : "";

  if (design === "animal") {
    const species = (study.studyType ?? "").trim();
    if (species && !/^(clinical|human|animal)$/i.test(species)) label = `Animal study (${species.toLowerCase()})`;
  }
  if (subject === "human" && label) label += " · Human study";
  if (!label) return null;

  const note =
    subject === "animal"
      ? "This research was done in animals. Results in animals often don't carry over to people."
      : subject === "in_vitro"
        ? "This research was done on cells or tissue in a lab, not in people or animals."
        : null;
  return { label, note };
}
