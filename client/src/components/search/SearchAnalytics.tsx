/**
 * Search Analytics Component
 * Tracks search events and user interactions for optimization
 */

import { trackEvent } from "@/lib/analytics";

export const trackSearchEvent = (eventType: string, data: any) => {
  switch (eventType) {
    case "search_performed":
      trackEvent("search", "search_query", data.query, data.resultsCount);
      break;

    case "search_suggestion_selected":
      trackEvent(
        "search_suggestion",
        "autocomplete",
        data.suggestion,
        data.position,
      );
      break;

    case "advanced_search_used":
      trackEvent("advanced_search", "filters", JSON.stringify(data.filters));
      break;

    case "study_selected_from_search":
      trackEvent("study_view", "search_result", data.studyTitle, data.position);
      break;

    case "search_filter_applied":
      trackEvent("search_filter", data.filterType, data.filterValue);
      break;

    case "search_saved":
      trackEvent("search_saved", "user_action", data.searchName);
      break;

    case "saved_search_loaded":
      trackEvent("saved_search_loaded", "user_action", data.searchName);
      break;

    case "search_exported":
      trackEvent("search_export", "user_action", data.format);
      break;

    case "search_page_changed":
      trackEvent("search_pagination", "navigation", "page_" + data.page);
      break;

    case "search_sort_changed":
      trackEvent(
        "search_sort",
        "user_preference",
        data.sortBy + "_" + data.sortOrder,
      );
      break;

    default:
      console.warn("Unknown search event type:", eventType);
  }

  // Also log to backend for detailed analytics
  fetch("/api/search/analytics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventType,
      data,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }),
  }).catch((error) => {
    console.warn("Failed to log search analytics:", error);
  });
};

export const trackStudyInteraction = (
  action: string,
  studyId: number,
  studyTitle: string,
  additionalData?: any,
) => {
  trackEvent("study_interaction", action, studyTitle, studyId);

  // Log detailed study interaction
  fetch("/api/studies/analytics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      studyId,
      studyTitle,
      additionalData,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    }),
  }).catch((error) => {
    console.warn("Failed to log study analytics:", error);
  });
};

export const trackUserEngagement = (
  action: string,
  category: string,
  label?: string,
  value?: number,
) => {
  trackEvent(action, category, label, value);

  // Log engagement metrics
  fetch("/api/analytics/engagement", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      category,
      label,
      value,
      timestamp: new Date().toISOString(),
      sessionId: sessionStorage.getItem("session_id") || "anonymous",
    }),
  }).catch((error) => {
    console.warn("Failed to log engagement analytics:", error);
  });
};
