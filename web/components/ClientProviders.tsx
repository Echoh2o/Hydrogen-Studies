"use client";

import { useState, type ReactNode } from "react";
import { HydrationBoundary, QueryClientProvider, type DehydratedState } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { installCsrfInterceptor } from "@/lib/csrf";
import { Toaster } from "@/components/ui/toaster";

/**
 * What the SPA's interactive page bodies expect around them (main.tsx /
 * App.tsx): React Query, toasts, and the CSRF header on same-origin writes.
 *
 * `dehydratedState` (web/lib/prefetch.ts) seeds React Query with responses
 * the server already fetched, so components that useQuery render their data
 * in the HTML and hydrate without a loading flash or a refetch.
 */
export function ClientProviders({ children, dehydratedState }: { children: ReactNode; dehydratedState?: DehydratedState }) {
  useState(() => installCsrfInterceptor()); // once, before any submit
  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>{children}</HydrationBoundary>
      <Toaster />
    </QueryClientProvider>
  );
}
