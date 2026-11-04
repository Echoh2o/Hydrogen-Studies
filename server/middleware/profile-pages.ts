/**
 * Researcher and journal profile pages (PLAN.md 4.7) — HTML bodies for the
 * page renderer (served by the Next front door to every visitor).
 *
 *   /researchers              index of authors with ≥ RESEARCHER_MIN_STUDIES
 *   /researchers/<slug>       one author: their studies, journals, topics
 *   /journals                 index of journals with ≥ JOURNAL_MIN_STUDIES
 *   /journals/<slug>          one journal: its hydrogen studies
 *
 * Only what the database holds is shown: names as published, counts, years,
 * and links to our study pages and to PubMed/OpenAlex author searches. No
 * affiliations, credentials or ORCIDs are claimed (follow-up: OpenAlex
 * authorships). Unknown slugs return null → 404 for everyone.
 */
import { conditionHubForValue, exploreHubPath } from "../../shared/explore-hubs";
import { journalBreadcrumbs, profilesIndexBreadcrumbs, researcherBreadcrumbs } from "../../shared/breadcrumbs";
import {
  JOURNALS_H1,
  JOURNAL_MIN_STUDIES,
  RESEARCHERS_H1,
  RESEARCHER_MIN_STUDIES,
  openAlexAuthorSearchUrl,
  pubmedAuthorUrl,
  type ProfileStudy,
} from "../../shared/profiles";
import { getAuthorIndex, getJournal, getJournalIndex, getResearcher } from "../services/profiles";
import { openAlexAuthorUrl, orcidUrl } from "../../shared/author-identity";
import { getConditionHubs, getTopConditions } from "./seo-body-renderer";
import { breadcrumbs, esc, footer } from "./html-fragments";

function span(first: number | null, last: number | null): string {
  if (!first || !last) return "";
  return first === last ? String(first) : `${first}–${last}`;
}

function studyList(studies: readonly ProfileStudy[]): string {
  let h = `<ul class="study-list">`;
  for (const s of studies) {
    h += `<li><a href="/study/${esc(s.slug)}">${esc(s.title)}</a>`;
    const meta = [s.year ? String(s.year) : "", s.journal ?? "", s.evidence ?? ""].filter(Boolean).join(" · ");
    if (meta) h += ` <span class="meta">— ${esc(meta)}</span>`;
    h += `</li>`;
  }
  return h + `</ul>\n`;
}

export async function renderResearcherIndex(): Promise<string> {
  const [{ list }, conditions] = await Promise.all([getAuthorIndex(), getTopConditions()]);
  let h = breadcrumbs(profilesIndexBreadcrumbs(RESEARCHERS_H1));
  h += `<h1>${esc(RESEARCHERS_H1)}</h1>\n`;
  h += `<p>Authors with at least ${RESEARCHER_MIN_STUDIES} studies in this database, most prolific first. Each page lists the author's hydrogen studies with links to the papers. Grouping is by published name, so two researchers who share a name share a page.</p>\n`;
  h += `<ul>`;
  for (const p of list) {
    const years = span(p.firstYear, p.lastYear);
    h += `<li><a href="/researchers/${esc(p.slug)}">${esc(p.name)}</a> — ${p.studies.length} studies`;
    if (p.humanCount) h += `, ${p.humanCount} in people`;
    if (years) h += ` (${years})`;
    h += `</li>`;
  }
  h += `</ul>\n`;
  h += footer(conditions);
  return h;
}

export async function renderResearcherPage(slug: string): Promise<string | null> {
  const p = await getResearcher(slug);
  if (!p) return null;
  const [conditions, hubs] = await Promise.all([getTopConditions(), getConditionHubs()]);
  let h = breadcrumbs(researcherBreadcrumbs(p.name));
  h += `<article>\n<h1>${esc(p.name)}</h1>\n`;
  const years = span(p.firstYear, p.lastYear);
  h += `<p class="lead">${p.studies.length} studies on molecular hydrogen in this database${years ? `, published ${years}` : ""}; ${p.humanCount} ${p.humanCount === 1 ? "was" : "were"} in people.</p>\n`;
  if (p.variants.length) h += `<p>Also published as: ${p.variants.map(esc).join(", ")}.</p>\n`;
  if (p.journals.length) {
    h += `<p>Publishes in: ${p.journals.map((j) => `${esc(j.name)} (${j.count})`).join(", ")}.</p>\n`;
  }
  if (p.conditions.length) {
    h += `<p>Most-studied topics: `;
    h += p.conditions
      .map((c) => {
        const hub = conditionHubForValue(c.name, hubs);
        const label = `${esc(hub?.name || c.name)} (${c.count})`;
        return hub ? `<a href="${esc(exploreHubPath("condition", hub.slug))}">${label}</a>` : label;
      })
      .join(", ");
    h += `.</p>\n`;
  }
  if (p.identity) {
    // Resolved identity (OpenAlex authorships on our studies): link the record, not a search.
    const idp: string[] = [];
    if (p.identity.orcid) idp.push(`ORCID <a href="${esc(orcidUrl(p.identity.orcid))}" rel="noopener">${esc(p.identity.orcid)}</a>`);
    if (p.identity.institution) idp.push(`affiliation (as listed on their recent hydrogen papers): ${esc(p.identity.institution)}${p.identity.institutionCountry ? ` (${esc(p.identity.institutionCountry)})` : ""}`);
    idp.push(`<a href="${esc(openAlexAuthorUrl(p.identity.openalexAuthorId))}" rel="noopener">OpenAlex author record</a>`);
    h += `<p class="identity">${idp.join(" · ")}. Resolved from the author lists of ${p.identity.occurrences} of their papers via OpenAlex; <a href="/contact">tell us</a> if this is the wrong person.</p>\n`;
    h += `<p>Also search: <a href="${esc(pubmedAuthorUrl(p.name))}" rel="noopener">PubMed</a>.</p>\n`;
  } else {
    h += `<p>Find this author elsewhere: <a href="${esc(pubmedAuthorUrl(p.name))}" rel="noopener">PubMed</a> · <a href="${esc(openAlexAuthorSearchUrl(p.name))}" rel="noopener">OpenAlex</a>.</p>\n`;
  }
  h += `<section><h2>Studies</h2>\n${studyList(p.studies)}</section>\n`;
  h += p.identity
    ? `<p class="note">About this page: it is built from the author names on the studies in our database and groups spellings of the same name. The ORCID and affiliation come from OpenAlex's author records for those papers and are shown only because one author account covers most of them; we hold no other credential data. Corrections: <a href="/contact">contact us</a>.</p>\n`
    : `<p class="note">About this page: it is built from the author names on the studies in our database and groups spellings of the same name. Researchers who share a name share a page, and we hold no affiliation or credential data for this name. Corrections: <a href="/contact">contact us</a>.</p>\n`;
  h += `</article>\n`;
  h += footer(conditions);
  return h;
}

export async function renderJournalIndex(): Promise<string> {
  const [{ list }, conditions] = await Promise.all([getJournalIndex(), getTopConditions()]);
  let h = breadcrumbs(profilesIndexBreadcrumbs(JOURNALS_H1));
  h += `<h1>${esc(JOURNALS_H1)}</h1>\n`;
  h += `<p>Journals with at least ${JOURNAL_MIN_STUDIES} molecular hydrogen studies in this database, most first. Each page lists the journal's hydrogen studies with links to the papers.</p>\n`;
  h += `<ul>`;
  for (const j of list) {
    const years = span(j.firstYear, j.lastYear);
    h += `<li><a href="/journals/${esc(j.slug)}">${esc(j.name)}</a> — ${j.studies.length} studies`;
    if (j.humanCount) h += `, ${j.humanCount} in people`;
    if (years) h += ` (${years})`;
    h += `</li>`;
  }
  h += `</ul>\n`;
  h += footer(conditions);
  return h;
}

export async function renderJournalPage(slug: string): Promise<string | null> {
  const j = await getJournal(slug);
  if (!j) return null;
  const conditions = await getTopConditions();
  let h = breadcrumbs(journalBreadcrumbs(j.name));
  h += `<article>\n<h1>${esc(j.name)}</h1>\n`;
  const years = span(j.firstYear, j.lastYear);
  h += `<p class="lead">${j.studies.length} studies on molecular hydrogen in this database${years ? `, published ${years}` : ""}; ${j.humanCount} ${j.humanCount === 1 ? "was" : "were"} in people.</p>\n`;
  h += `<section><h2>Studies</h2>\n${studyList(j.studies)}</section>\n`;
  h += `<p class="note">About this page: it lists the studies in our database whose journal field names this journal. It is not the journal's full output on hydrogen, and inclusion here says nothing about the journal's quality.</p>\n`;
  h += `</article>\n`;
  h += footer(conditions);
  return h;
}
