// Plain module (not "use client") so the Next server can build the same
// /api/studies query the StudiesContent client component builds on load.
import type { Study } from "@/types";

export interface StudiesPageResponse {
  data: Study[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export const STUDIES_PAGE_SIZE = 20;

const FILTER_KEYS = ["query", "keyword", "author", "yearFrom", "yearTo", "category", "sortBy", "sortOrder"] as const;
const DEFAULTS: Record<string, string> = { sortBy: "publishYear", sortOrder: "desc" };

/** The query string StudiesContent sends for a given page URL search. */
export function studiesQueryString(search: string): string {
  const url = new URLSearchParams(search);
  const params = new URLSearchParams();
  params.append("page", String(parseInt(url.get("page") || "1") || 1));
  params.append("limit", String(STUDIES_PAGE_SIZE));
  for (const key of FILTER_KEYS) {
    const value = (url.get(key) || DEFAULTS[key] || "").trim();
    if (value && value !== "all" && value !== "any") params.append(key, value);
  }
  return params.toString();
}
