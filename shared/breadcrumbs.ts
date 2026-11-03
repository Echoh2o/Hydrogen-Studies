/**
 * Breadcrumb trails shared by the page renderer (the visible <nav>) and page
 * meta (the BreadcrumbList JSON-LD), so schema only ever describes what the
 * page shows (CLAUDE.md). One builder per page type; the last crumb has no
 * href. Study pages build theirs in shared/study-page.ts (studyBreadcrumbs).
 */
export interface Crumb {
  label: string;
  href?: string;
}

const HOME: Crumb = { label: "Home", href: "/" };

/** Same rule the renderer has always used: cut to max−3 and add "...". */
export function truncateLabel(str: string, max: number): string {
  if (!str || str.length <= max) return str || "";
  return str.substring(0, max - 3) + "...";
}

/** The visible trail truncates the current page's crumb to 60 characters. */
export const LAST_CRUMB_MAX = 60;

export function blogPostBreadcrumbs(title: string): Crumb[] {
  return [HOME, { label: "Blog", href: "/blog" }, { label: truncateLabel(title, 50) }];
}

export function blogListBreadcrumbs(): Crumb[] {
  return [HOME, { label: "Blog" }];
}

export function studiesListBreadcrumbs(): Crumb[] {
  return [HOME, { label: "Research Studies" }];
}

export function conditionHubBreadcrumbs(conditionName: string): Crumb[] {
  return [HOME, { label: "Health Conditions", href: "/explore-by-condition" }, { label: conditionName }];
}

export function bodySystemHubBreadcrumbs(displayName: string): Crumb[] {
  return [HOME, { label: "Body Systems", href: "/explore-by-body-system" }, { label: displayName }];
}

export const EXPLORE_PARENT_LABELS: Record<string, string> = {
  mechanism: "Mechanisms",
  "delivery-method": "Delivery Methods",
  "life-stage": "Life Stages",
  benefit: "Benefits",
  demographic: "Demographics",
};

export function exploreDetailBreadcrumbs(type: string, displayName: string): Crumb[] {
  return [HOME, { label: EXPLORE_PARENT_LABELS[type] || type, href: `/explore-by-${type}` }, { label: displayName }];
}

export function exploreIndexBreadcrumbs(title: string): Crumb[] {
  return [HOME, { label: title }];
}

export function hydrogenForBreadcrumbs(displayName: string): Crumb[] {
  return [HOME, { label: `Hydrogen for ${displayName}` }];
}

export function policyBreadcrumbs(title: string): Crumb[] {
  return [HOME, { label: title }];
}

/**
 * Standalone BreadcrumbList block for the trail as rendered: the current
 * page's name is truncated exactly like the visible crumb.
 */
export function breadcrumbListJsonLd(crumbs: readonly Crumb[], siteUrl: string): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: i === crumbs.length - 1 ? truncateLabel(c.label, LAST_CRUMB_MAX) : c.label,
      ...(c.href ? { item: `${siteUrl}${c.href}` } : {}),
    })),
  };
}
