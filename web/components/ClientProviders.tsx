"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { installCsrfInterceptor } from "@/lib/csrf";
import { Toaster } from "@/components/ui/toaster";

/**
 * What the SPA's interactive page bodies expect around them (main.tsx /
 * App.tsx): React Query, toasts, and the CSRF header on same-origin writes.
 */
export function ClientProviders({ children }: { children: ReactNode }) {
  useState(() => installCsrfInterceptor()); // once, before any submit
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
