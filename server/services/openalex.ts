/**
 * OpenAlex (https://docs.openalex.org) — free, no key. Used for citation
 * counts (PLAN.md 4.4): `cited_by_count` per work, looked up in batches by DOI
 * or PubMed ID with the `|` OR filter (≤50 values per request). The polite
 * pool (mailto) allows 10 requests/second; we stay well under it.
 */
import { normalizeDoi } from "../../shared/seo-markup";

export const OPENALEX_API = "https://api.openalex.org";
export const OPENALEX_MAILTO = process.env.OPENALEX_MAILTO || "research@hydrogenstudies.com";
/** OpenAlex caps OR-filters at 50 values. */
export const OPENALEX_BATCH = 50;

export interface OpenAlexWork {
  /** "W2401015570" */
  id: string;
  doi: string | null;
  pmid: string | null;
  citedByCount: number;
}

interface RawWork {
  id?: string;
  doi?: string | null;
  cited_by_count?: number;
  ids?: { pmid?: string | null; doi?: string | null };
}

/** "https://openalex.org/W123" → "W123"; already-bare ids pass through. */
export function openAlexId(idOrUrl: string | null | undefined): string | null {
  const m = String(idOrUrl ?? "").match(/W\d+$/);
  return m ? m[0] : null;
}

/** "https://pubmed.ncbi.nlm.nih.gov/27826423" → "27826423". */
export function pmidFromUrl(url: string | null | undefined): string | null {
  const m = String(url ?? "").match(/(\d{4,9})\/?$/);
  return m ? m[1] : null;
}

export function parseWork(raw: RawWork): OpenAlexWork | null {
  const id = openAlexId(raw.id);
  if (!id || typeof raw.cited_by_count !== "number") return null;
  return {
    id,
    doi: normalizeDoi(raw.doi ?? raw.ids?.doi) || null,
    pmid: pmidFromUrl(raw.ids?.pmid),
    citedByCount: raw.cited_by_count,
  };
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Look up works by DOI and/or PMID. Returns maps keyed by normalized lowercase
 * DOI and by PMID. Request failures throw after `retries` attempts so a caller
 * can record the batch as errored rather than as "no match".
 */
export async function fetchOpenAlexWorks(
  input: { dois?: readonly string[]; pmids?: readonly string[] },
  opts: { fetchImpl?: typeof fetch; delayMs?: number; retries?: number } = {},
): Promise<{ byDoi: Map<string, OpenAlexWork>; byPmid: Map<string, OpenAlexWork>; requests: number }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const delayMs = opts.delayMs ?? 150;
  const retries = opts.retries ?? 3;
  const byDoi = new Map<string, OpenAlexWork>();
  const byPmid = new Map<string, OpenAlexWork>();
  let requests = 0;

  const run = async (field: "doi" | "pmid", values: string[]) => {
    for (const batch of chunk(values, OPENALEX_BATCH)) {
      const filter = `${field}:${batch.join("|")}`;
      const url = `${OPENALEX_API}/works?filter=${encodeURIComponent(filter)}&select=id,doi,cited_by_count,ids&per-page=${OPENALEX_BATCH}&mailto=${encodeURIComponent(OPENALEX_MAILTO)}`;
      let lastErr: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          requests++;
          const res = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
          if (res.status === 429 || res.status >= 500) throw new Error(`OpenAlex ${res.status}`);
          if (!res.ok) throw new Error(`OpenAlex ${res.status}`);
          const json = (await res.json()) as { results?: RawWork[] };
          for (const raw of json.results ?? []) {
            const w = parseWork(raw);
            if (!w) continue;
            if (w.doi) byDoi.set(w.doi.toLowerCase(), w);
            if (w.pmid) byPmid.set(w.pmid, w);
          }
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          await sleep(delayMs * 4 * (attempt + 1));
        }
      }
      if (lastErr) throw lastErr;
      await sleep(delayMs);
    }
  };

  const dois = [...new Set((input.dois ?? []).map((d) => normalizeDoi(d).toLowerCase()).filter(Boolean))];
  const pmids = [...new Set((input.pmids ?? []).map((p) => String(p).trim()).filter((p) => /^\d{4,9}$/.test(p)))];
  if (dois.length) await run("doi", dois);
  if (pmids.length) await run("pmid", pmids);
  return { byDoi, byPmid, requests };
}
