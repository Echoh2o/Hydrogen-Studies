/**
 * The scientific reviewer, one source for every visible byline, the policy
 * pages and the schema (CLAUDE.md: reviewedBy only for a named reviewer, and
 * schema only for what's visible).
 *
 * Josh, 2026-11-05: Sarah reviews and double-checks every study before it is
 * published (new studies wait in the admin approval queue, pipeline_queue
 * status awaiting_approval) and has reviewed every study already in the
 * database. She works for Echo (contractor, Research Director), so the
 * affiliation is always shown and she is never described as independent.
 * Bio text supplied by Sarah via Josh.
 *
 * No per-study review date is recorded yet, so pages show the reviewer's
 * name without a "Last reviewed" date and the schema carries no
 * lastReviewed.
 */
export const STUDY_REVIEWER = {
  name: "Sarah Taylor-Laine",
  /** Short post-nominal for bylines. */
  postNominal: "M.Sc.",
  credentials: "B.Sc. and M.Sc. in Biology, California State University",
  jobTitle: "Research Director",
  employer: "Echo Water",
  /** Plain statement of the relationship, shown wherever she is named. */
  relationship: "Research Director at Echo Water (contractor)",
  memberships: ["Founding board member, American Hydrogen Health Association (AHHA)"],
  /** Section anchor on /editorial-policy (shared/heading-id of the heading). */
  profileHref: "/editorial-policy#our-scientific-reviewer",
  bio:
    "Sarah Taylor-Laine (B.Sc. and M.Sc. in Biology, California State University) is Research Director at Echo Water, which funds this site; she works with Echo as a contractor. She is also a founding board member of the American Hydrogen Health Association (AHHA). Her career spans academic and applied research, product development, regulatory consulting and scientific communication.",
} as const;

/** "Sarah Taylor-Laine, M.Sc., Research Director, Echo Water" */
export function reviewerBylineLabel(): string {
  const r = STUDY_REVIEWER;
  return `${r.name}, ${r.postNominal}, ${r.jobTitle}, ${r.employer}`;
}

/** schema.org Person for reviewedBy — only what the page shows. */
export function reviewerPersonJsonLd(siteUrl: string): Record<string, any> {
  const r = STUDY_REVIEWER;
  return {
    "@type": "Person",
    name: r.name,
    jobTitle: r.jobTitle,
    worksFor: { "@type": "Organization", name: r.employer, url: "https://echowater.com" },
    hasCredential: { "@type": "EducationalOccupationalCredential", credentialCategory: "degree", name: r.credentials },
    url: `${siteUrl}${r.profileHref}`,
  };
}
