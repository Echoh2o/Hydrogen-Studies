"use client";

import type { ReactNode } from "react";
import { Router } from "wouter";

/**
 * Lets SPA components that use wouter (Link, useSearch, useLocation) render
 * inside Next pages. On the server it supplies the request path/search; in
 * the browser, navigation is a full page load — there is no SPA router here,
 * so a pushState-only wouter navigation would change the URL and nothing else.
 */
export function WouterBridge({ path, search, children }: { path: string; search: string; children: ReactNode }) {
  return (
    <Router
      ssrPath={path}
      ssrSearch={search}
      hook={() => [
        path,
        (to: string) => {
          window.location.assign(to);
        },
      ]}
      searchHook={() => search}
    >
      {children}
    </Router>
  );
}
