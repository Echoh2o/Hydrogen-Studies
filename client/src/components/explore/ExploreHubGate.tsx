import React from "react";
import { useQuery } from "@tanstack/react-query";
import type { ExploreHubType } from "@shared/explore-hubs";
import NotFound from "@/pages/not-found";
import { isNotFoundError, retryUnlessNotFound } from "./ExploreHubDetail";

interface ExploreHubGateProps {
  type: ExploreHubType;
  /** Route param of the hub URL (/explore-by-<type>/<slug>). */
  slug: string | undefined;
  children: React.ReactNode;
}

/**
 * Renders the site's NotFound page (noindex) instead of `children` when
 * /explore-by-<type>/<slug> isn't a hub — GET /api/explore/:type/:slug answers
 * 404, from the same predicate that makes the server send the SPA shell with
 * HTTP 404 and crawlers a hard 404 (seo-body-renderer exploreHubExists).
 *
 * For the condition / body-system / life-stage pages, which load their study
 * lists from other endpoints. The page renders immediately (a real hub never
 * waits on this check); an unknown hub swaps to NotFound when the 404 lands.
 */
export default function ExploreHubGate({ type, slug, children }: ExploreHubGateProps) {
  const s = (slug ?? "").toLowerCase();
  const { error } = useQuery<{ type: string; slug: string; path: string }>({
    queryKey: [`/api/explore/${type}/${encodeURIComponent(s)}`],
    enabled: !!s,
    retry: retryUnlessNotFound,
  });
  if (!s || isNotFoundError(error)) return <NotFound />;
  return <>{children}</>;
}
