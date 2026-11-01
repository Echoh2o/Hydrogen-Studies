/**
 * DOI → PMID lookup with verification (NCBI E-utilities).
 *
 * esearch `"<doi>"[doi]` proposes candidate PMIDs; esummary then confirms that
 * the PubMed record's own DOI equals ours (case-insensitive, after stripping
 * resolver prefixes). Only a single verified PMID counts as a match — PubMed's
 * phrase search can return near-misses, and a wrong PMID would point a study
 * page's source link and schema identifier at a different paper.
 *
 * Requests go through `externalApi`, whose interceptor spaces calls to
 * eutils.ncbi.nlm.nih.gov (100ms with PUBMED_API_KEY ⇒ ≤10 req/s) and retries 429s.
 */
import { externalApi } from "../utils/http";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

export type PmidStatus = "matched" | "no_hit" | "mismatch" | "multiple";

export interface PmidLookupResult {
  status: PmidStatus;
  /** The verified PMID (matched) or the candidates seen (others), ";"-joined. */
  pmid: string;
  /** DOIs PubMed holds for the candidate PMIDs — evidence for mismatch review. */
  pubmedDois: string;
}

/** Strip resolver prefixes / "doi:" labels and whitespace; lowercase for comparison. */
export function normalizeDoi(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim()
    .toLowerCase();
}

/** A DOI is usable for lookup only if it looks like one (10.<registrant>/<suffix>). */
export function isLookupableDoi(doi: string): boolean {
  return /^10\.\d{4,9}\/\S+$/.test(doi) && !doi.includes('"');
}

/** DOIs a PubMed esummary record carries (articleids idtype=doi, plus elocationid). */
export function summaryDois(rec: any): string[] {
  const out = new Set<string>();
  for (const a of rec?.articleids ?? []) {
    if (a?.idtype === "doi" && a.value) out.add(normalizeDoi(a.value));
  }
  const loc = String(rec?.elocationid ?? "");
  for (const m of loc.matchAll(/doi:\s*(\S+)/gi)) out.add(normalizeDoi(m[1]));
  out.delete("");
  return [...out];
}

/**
 * Classify esearch candidates against their esummary records.
 * matched  — exactly one candidate whose PubMed DOI equals ours
 * multiple — more than one candidate carries our DOI (ambiguous; never filled)
 * mismatch — candidates exist but none carries our DOI
 * no_hit   — esearch returned nothing
 */
export function classifyCandidates(
  doi: string,
  candidates: string[],
  summaries: Record<string, any>,
): PmidLookupResult {
  const target = normalizeDoi(doi);
  if (!candidates.length) return { status: "no_hit", pmid: "", pubmedDois: "" };
  const doisByPmid = candidates.map((p) => ({ pmid: p, dois: summaryDois(summaries[p]) }));
  const verified = doisByPmid.filter((c) => c.dois.includes(target));
  const pubmedDois = doisByPmid.map((c) => `${c.pmid}:${c.dois.join("|") || "(none)"}`).join("; ");
  if (verified.length === 1) return { status: "matched", pmid: verified[0].pmid, pubmedDois };
  if (verified.length > 1) return { status: "multiple", pmid: verified.map((v) => v.pmid).join(";"), pubmedDois };
  return { status: "mismatch", pmid: candidates.join(";"), pubmedDois };
}

function keyParam(): Record<string, string> {
  return process.env.PUBMED_API_KEY ? { api_key: process.env.PUBMED_API_KEY } : {};
}

/** esearch PubMed for a DOI; returns candidate PMIDs (max 5). */
export async function esearchDoi(doi: string): Promise<string[]> {
  const res = await externalApi.get(`${EUTILS}/esearch.fcgi`, {
    params: { db: "pubmed", retmode: "json", retmax: 5, term: `"${doi}"[doi]`, tool: "hydrogenstudies", ...keyParam() },
  });
  const r = res.data?.esearchresult;
  if (!r) throw new Error(`esearch: unexpected response for ${doi}`);
  if (r.ERROR) throw new Error(`esearch error for ${doi}: ${r.ERROR}`);
  return (r.idlist ?? []).map(String);
}

/** esummary for up to ~200 PMIDs; returns uid → record. */
export async function esummary(pmids: string[]): Promise<Record<string, any>> {
  if (!pmids.length) return {};
  const res = await externalApi.post(
    `${EUTILS}/esummary.fcgi`,
    new URLSearchParams({ db: "pubmed", retmode: "json", id: pmids.join(","), tool: "hydrogenstudies", ...keyParam() }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  const result = res.data?.result;
  if (!result) throw new Error("esummary: unexpected response");
  return result;
}
