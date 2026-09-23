import { useMemo } from "react";
import { useLocation } from "wouter";
import { pageContextFromPath, type EchoUtmContext } from "@shared/echo-products";

/**
 * UTM page context for the current route (CLAUDE.md: every echowater.com link
 * carries utm_campaign=<page_type>&utm_content=<slug> of the page it sits on).
 * Same derivation as the bot renderer (shared pageContextFromPath), so a link
 * is tagged identically for browsers and crawlers.
 */
export function useEchoPageContext(): EchoUtmContext {
  const [location] = useLocation();
  return useMemo(() => pageContextFromPath(location), [location]);
}
