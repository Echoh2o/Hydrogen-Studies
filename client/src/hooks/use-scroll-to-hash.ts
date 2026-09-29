import { useEffect } from "react";

/**
 * Jump to the #section in the URL once the page's content has rendered.
 *
 * The browser's own hash jump fires on the initial load, before the SPA has
 * fetched and rendered the article, so links like
 * /blog/hydrogen-therapy-machine-home#is-hydrogen-flammable landed at the top
 * even though the heading carries that id (shared/heading-id). Call with
 * ready=true once the content is in the DOM.
 */
export function useScrollToHash(ready: boolean): void {
  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const raw = window.location.hash.slice(1);
    if (!raw) return;
    let id = raw;
    try {
      id = decodeURIComponent(raw);
    } catch {
      // Malformed escape: use the raw fragment.
    }
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ready]);
}
