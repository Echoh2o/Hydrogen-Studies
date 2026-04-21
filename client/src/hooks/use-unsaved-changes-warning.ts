import { useEffect } from "react";

/**
 * Warn the user before they navigate away from a page with unsaved form edits.
 *
 * Usage:
 *   const form = useForm(...);
 *   useUnsavedChangesWarning(form.formState.isDirty);
 *
 * Shows the browser's native "Changes you made may not be saved" dialog on
 * tab close, reload, and cross-origin navigation. Intra-SPA navigation via
 * wouter's setLocation doesn't fire beforeunload — if we want that too, each
 * consumer can intercept link clicks separately. The tab-close case is the
 * most common data-loss scenario and is fully covered here.
 */
export function useUnsavedChangesWarning(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      // Spec: preventDefault + returnValue triggers the prompt. Message
      // is ignored by modern browsers; they show a generic warning.
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
