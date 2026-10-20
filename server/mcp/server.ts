/**
 * Hydrogen Studies MCP server — tools, resources and prompts over the study
 * corpus. Built fresh per request (stateless Streamable HTTP; see ./http.ts).
 *
 * Public tier: read-only evidence tools; the client's own model writes the
 * answer. Output never includes full abstracts (≤300-char excerpt + DOI link,
 * publisher copyright) and never includes product / echowater links (PLAN.md
 * Appendix E: no product content on disease topics).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DELIVERY_METHODS, OUTCOMES, STUDY_DESIGNS } from "@shared/research-vocab";
import { getPublicStudyStats } from "../services/public-study-stats";
import {
  GROUP_BY,
  SITE_URL,
  aggregate,
  evidenceProfile,
  findStudies,
  getCorpus,
  getStudyDetail,
  listConditions,
  parseStudyRef,
  relatedStudies,
  studyCard,
  type ResearchFilters,
} from "../services/research-query";
import { logger } from "../utils/logger";

export type McpTier = "public" | "admin";

export const SERVER_INSTRUCTIONS = `Hydrogen Studies (${SITE_URL}) is a curated database of published research on molecular hydrogen (H2) — drinking hydrogen-rich water, inhalation, hydrogen-rich saline and more.

How to use these tools well:
- Start broad with search_studies or get_condition_evidence, then drill into individual studies with get_study.
- Use compare_evidence for "X vs Y" questions and aggregate_studies for counts and trends.
- Always separate human evidence (subject "human"; design rct > controlled_trial > uncontrolled_trial > observational > case_report) from animal and in-vitro work, and say how many human trials and participants an answer rests on.
- Cite studies with their hydrogenstudies.com url (and doi_url where useful).
- Report coverage honestly: fields like design, outcome and delivery method are unknown for some studies; the tools count unknowns separately rather than guessing.
- These are research summaries, not medical advice. Do not present findings as treatments or cures; most human trials are small.
- Disclosure: Hydrogen Studies is built and funded by Echo Technologies LLC, a maker of hydrogen water products. Mention this when a user asks about bias or funding.`;

const subjectEnum = z.enum(["human", "animal", "in_vitro", "review"]);

const filterShape = {
  query: z.string().max(300).optional().describe("Full-text search terms, e.g. 'exercise fatigue lactate'"),
  condition: z
    .string()
    .max(100)
    .optional()
    .describe("Condition hub slug or name, e.g. 'blood-pressure' or 'Blood Pressure' (see list_conditions)"),
  subject: subjectEnum.optional().describe("Who/what was studied"),
  design: z.enum(STUDY_DESIGNS).optional().describe("Study design"),
  delivery_method: z.enum(DELIVERY_METHODS).optional().describe("How hydrogen was administered"),
  outcome: z.enum(OUTCOMES).optional().describe("Direction of the reported hydrogen effect"),
  year_from: z.number().int().min(1900).max(2100).optional(),
  year_to: z.number().int().min(1900).max(2100).optional(),
  min_sample_size: z.number().int().min(1).optional().describe("Minimum participants/animals"),
};
const filterObject = z.object(filterShape);
type FilterArgs = z.infer<typeof filterObject>;

function toFilters(a: FilterArgs): ResearchFilters {
  return {
    query: a.query,
    condition: a.condition,
    subject: a.subject,
    design: a.design,
    deliveryMethod: a.delivery_method,
    outcome: a.outcome,
    yearFrom: a.year_from,
    yearTo: a.year_to,
    minSampleSize: a.min_sample_size,
  };
}

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });
const fail = (message: string) => ({ isError: true, content: [{ type: "text" as const, text: message }] });

/** Wrap a handler with timing/logging and a uniform error result. */
function instrument<A>(tier: McpTier, tool: string, fn: (args: A) => Promise<ReturnType<typeof json> | ReturnType<typeof fail>>) {
  return async (args: A) => {
    const started = Date.now();
    try {
      const out = await fn(args);
      logger.info("MCP tool call", "MCP", { tier, tool, ms: Date.now() - started, error: "isError" in out });
      return out;
    } catch (err) {
      logger.error("MCP tool failed", err, "MCP", { tier, tool });
      return fail(`${tool} failed: ${err instanceof Error ? err.message : "internal error"}`);
    }
  };
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

export function buildMcpServer({ tier }: { tier: McpTier }): McpServer {
  const server = new McpServer(
    { name: "hydrogen-studies", title: "Hydrogen Studies research database", version: "1.0.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    "search_studies",
    {
      title: "Search studies",
      description:
        "Find molecular hydrogen studies by keywords and/or filters. Returns compact study records (design, subject, sample size, delivery method, outcome, key finding, url). Sorted by relevance when a query is given, otherwise by strength of evidence.",
      inputSchema: {
        ...filterShape,
        sort: z.enum(["relevance", "evidence", "newest", "quality"]).optional(),
        limit: z.number().int().min(1).max(50).optional().describe("Default 10"),
        offset: z.number().int().min(0).optional(),
      },
      annotations: { title: "Search studies", ...READ_ONLY },
    },
    instrument(tier, "search_studies", async (a) => {
      const { studies, condition, notes } = await findStudies(toFilters(a), a.sort);
      const offset = a.offset ?? 0;
      const page = studies.slice(offset, offset + (a.limit ?? 10));
      return json({
        total_matches: studies.length,
        offset,
        returned: page.length,
        condition_hub: condition,
        notes,
        studies: page.map(studyCard),
      });
    }),
  );

  server.registerTool(
    "get_study",
    {
      title: "Get study",
      description:
        "Full record for one study: citation, design, population, H2 protocol (delivery, concentration, dosage), outcome, our plain-language summary and key finding, limitations, quality score with red flags, conditions/mechanisms, and links. Accepts an id, slug, DOI or study URL.",
      inputSchema: { study: z.string().min(1).max(300).describe("Study id, slug, DOI, or hydrogenstudies.com/study/... URL") },
      annotations: { title: "Get study", ...READ_ONLY },
    },
    instrument(tier, "get_study", async ({ study }) => {
      const detail = await getStudyDetail(study, { full: tier === "admin" });
      return detail ? json(detail) : fail(`No study found for "${study}". Use search_studies to find one.`);
    }),
  );

  server.registerTool(
    "get_condition_evidence",
    {
      title: "Condition evidence profile",
      description:
        "Evidence profile for a health condition hub: how many studies, human vs animal vs in-vitro, number of human RCTs and participants, outcome mix, delivery methods, publication years, data coverage, and the strongest studies.",
      inputSchema: {
        condition: z.string().min(1).max(100).describe("Condition hub slug or name (see list_conditions)"),
        subject: subjectEnum.optional().describe("Restrict the profile to one subject type"),
        top_studies: z.number().int().min(1).max(20).optional().describe("How many strongest studies to list (default 5)"),
      },
      annotations: { title: "Condition evidence profile", ...READ_ONLY },
    },
    instrument(tier, "get_condition_evidence", async (a) => {
      const { studies, condition } = await findStudies({ condition: a.condition, subject: a.subject });
      if (!condition) {
        return fail(`"${a.condition}" is not a condition hub. Call list_conditions, or use search_studies with condition/query for other topics.`);
      }
      return json({ condition, profile: evidenceProfile(studies, a.top_studies ?? 5) });
    }),
  );

  server.registerTool(
    "compare_evidence",
    {
      title: "Compare evidence",
      description:
        "Side-by-side evidence profiles for 2–4 groups of studies, e.g. inhalation vs drinking water for one condition, or two conditions. Each group is a set of filters merged over the optional shared filters.",
      inputSchema: {
        shared: filterObject.optional().describe("Filters applied to every group"),
        groups: z
          .array(filterObject.extend({ label: z.string().min(1).max(60) }))
          .min(2)
          .max(4),
        top_studies: z.number().int().min(0).max(10).optional().describe("Strongest studies listed per group (default 3)"),
      },
      annotations: { title: "Compare evidence", ...READ_ONLY },
    },
    instrument(tier, "compare_evidence", async (a) => {
      const groups = await Promise.all(
        a.groups.map(async ({ label, ...g }) => {
          const merged = { ...toFilters(a.shared ?? {}), ...stripUndefined(toFilters(g)) };
          const { studies, condition, notes } = await findStudies(merged);
          return { label, filters: stripUndefined(merged), condition_hub: condition, notes, profile: evidenceProfile(studies, a.top_studies ?? 3) };
        }),
      );
      return json({ groups });
    }),
  );

  server.registerTool(
    "aggregate_studies",
    {
      title: "Aggregate studies",
      description:
        "Count matching studies grouped by year, subject, design, delivery_method, outcome, country, condition or species — for trends and 'how many' questions. Unknown values are counted separately.",
      inputSchema: {
        ...filterShape,
        group_by: z.enum(GROUP_BY),
        top: z.number().int().min(1).max(100).optional().describe("Max buckets returned (default 40)"),
      },
      annotations: { title: "Aggregate studies", ...READ_ONLY },
    },
    instrument(tier, "aggregate_studies", async (a) => {
      const { studies, condition, notes } = await findStudies(toFilters(a));
      return json({ condition_hub: condition, notes, ...aggregate(studies, a.group_by, a.top ?? 40) });
    }),
  );

  server.registerTool(
    "find_related_studies",
    {
      title: "Related studies",
      description: "Studies a given study cites, studies that cite it, and the most similar studies by shared health conditions.",
      inputSchema: { study: z.string().min(1).max(300).describe("Study id, slug, DOI or URL") },
      annotations: { title: "Related studies", ...READ_ONLY },
    },
    instrument(tier, "find_related_studies", async ({ study }) => {
      const ref = parseStudyRef(study);
      const id = ref.kind === "id" ? Number(ref.value) : (await getStudyDetail(study))?.id;
      const related = id ? await relatedStudies(id) : null;
      return related ? json(related) : fail(`No study found for "${study}".`);
    }),
  );

  server.registerTool(
    "list_conditions",
    {
      title: "List conditions",
      description: "Every health condition hub with its study count, evidence grade (where reviewed) and page URL. Use the slug as the `condition` filter.",
      inputSchema: {},
      annotations: { title: "List conditions", ...READ_ONLY },
    },
    instrument(tier, "list_conditions", async () => json({ conditions: await listConditions() })),
  );

  server.registerTool(
    "get_database_stats",
    {
      title: "Database stats",
      description: "Size and makeup of the database: total studies, breakdown by subject and design, year range, and field coverage.",
      inputSchema: {},
      annotations: { title: "Database stats", ...READ_ONLY },
    },
    instrument(tier, "get_database_stats", async () => {
      const [{ rows }, totals] = await Promise.all([getCorpus(), getPublicStudyStats()]);
      const { strongest_studies: _omit, ...profile } = evidenceProfile(rows, 0);
      return json({ site: SITE_URL, ...profile, total_studies: totals.totalStudies, health_condition_hubs: totals.healthConditions });
    }),
  );

  server.registerResource(
    "about",
    "hydrogenstudies://about",
    { title: "About Hydrogen Studies", description: "Methodology, field definitions and funding disclosure", mimeType: "text/markdown" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: ABOUT_MARKDOWN }] }),
  );

  server.registerPrompt(
    "evidence_review",
    {
      title: "Evidence review",
      description: "Write a balanced, cited review of what the research says about molecular hydrogen for a topic.",
      argsSchema: { topic: z.string().describe("e.g. 'exercise recovery' or 'blood pressure'") },
    },
    ({ topic }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Using the Hydrogen Studies tools, write a balanced evidence review of molecular hydrogen for: ${topic}.
1. Call get_condition_evidence if "${topic}" matches a condition hub (list_conditions), otherwise search_studies with a query.
2. Open the strongest human studies with get_study.
3. Structure: bottom line (2 sentences) · human evidence (designs, participants, outcomes) · animal/in-vitro evidence · delivery methods and doses studied · limitations and gaps.
4. Cite every claim with the study url. State how many human trials and participants the conclusion rests on. No treatment or cure claims.`,
          },
        },
      ],
    }),
  );

  return server;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export const ABOUT_MARKDOWN = `# Hydrogen Studies

${SITE_URL} indexes published research on molecular hydrogen (H2) and summarizes each study in plain language.

## Fields
- **subject** — human, animal, in_vitro or review (derived from the study design, or the species when design is unknown).
- **design** — ${STUDY_DESIGNS.join(", ")}.
- **delivery_method** — ${DELIVERY_METHODS.join(", ")}.
- **outcome** — direction of the reported hydrogen effect: ${OUTCOMES.join(", ")}.
- **sample_size / duration_days** — as reported in the abstract; null when not stated.
- **quality_score** — our 0–100 rubric score (methodology, impact, relevance) with red flags.
- **key_finding / plain_summary / tldr** — written by Hydrogen Studies. Abstracts are not republished; follow doi_url for the paper.

Design, outcome, sample size and delivery method were extracted from titles and abstracts with AI assistance and can be wrong or missing; every aggregate reports how many studies had a known value.

## Not medical advice
These are research summaries. Most human trials of molecular hydrogen are small and short; findings are not evidence that hydrogen treats or cures any disease.

## Funding disclosure
Hydrogen Studies is built and funded by Echo Technologies LLC, the maker of Echo Water hydrogen water products.
`;
