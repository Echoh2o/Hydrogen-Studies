import { useQuery } from "@tanstack/react-query";

/**
 * Newest study change (YYYY-MM-DD) from /api/public-stats — the truthful
 * "Last updated" date for site-wide listings (shared/page-byline.ts). Needs a
 * QueryClient; the Next pages prefetch this key so the date is in the HTML.
 */
export function useSiteLastUpdated(): string | null {
  const { data } = useQuery<{ latestStudyUpdate?: string | null }>({
    queryKey: ["/api/public-stats"],
    staleTime: 1000 * 60 * 10,
  });
  return data?.latestStudyUpdate ?? null;
}
