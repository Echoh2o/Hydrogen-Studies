import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });
}

/**
 * Safely format authors for display.
 * Handles: string, array of objects [{name, authorId}], array of strings, null/undefined
 */
export function formatAuthors(authors: unknown): string {
  if (!authors) return "";
  if (typeof authors === "string") return authors;
  if (Array.isArray(authors)) {
    return authors
      .map((a) => (typeof a === "string" ? a : a?.name || a?.authorName || ""))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof authors === "object" && authors !== null && "name" in authors) {
    return (authors as { name: string }).name;
  }
  return String(authors);
}

/**
 * Safely extract an array from an API response of unknown shape.
 * Handles: a bare array, or an object wrapping the array under a common
 * key ({ data }, { studies }, { articles }, { results }, { items }).
 * Always returns an array, so .map()/.filter() are safe on the result.
 *
 * Canonical extraction of the ad-hoc pattern inlined in several pages
 * (e.g. StudyPage's relatedArray, BlogListPage's articles) — prefer this
 * util for new code so the response-shape handling stays in one place.
 */
export function safeArray(response: unknown): any[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === "object") {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.studies)) return obj.studies;
    if (Array.isArray(obj.articles)) return obj.articles;
    if (Array.isArray(obj.results)) return obj.results;
    if (Array.isArray(obj.items)) return obj.items;
  }
  return [];
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Safely extract a human-readable message from an unknown error value.
 * Prefer this over `catch (error: any)` + `error.message || "..."` — it
 * type-narrows correctly and handles non-Error throws (strings, objects).
 *
 *   try { ... } catch (err) {
 *     toast({ title: "Save failed", description: errMessage(err) });
 *   }
 */
export function errMessage(err: unknown, fallback = "An unexpected error occurred"): string {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string") return err || fallback;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}
