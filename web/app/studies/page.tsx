import { StudiesContent } from "@/pages/content/StudiesContent";
import { studiesQueryString, type StudiesPageResponse } from "@/pages/content/studies-query";
import { abstractExcerpt } from "@shared/seo-markup";
import { contentPage } from "@web/lib/content-page";
import { expressJson } from "@web/lib/page-data";
import { ClientProviders } from "@web/components/ClientProviders";
import { WouterBridge } from "@web/components/WouterBridge";

// The SPA's interactive studies browser, with the requested page of results
// rendered on the server (real HTML list + crawlable page links).
const page = contentPage("/studies");

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;

/** Only what StudyCard renders — never a full abstract in the page (CLAUDE.md). */
function forCards(res: StudiesPageResponse): StudiesPageResponse {
  return {
    ...res,
    data: res.data.map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      journal: s.journal,
      category: s.category,
      authors: s.authors,
      publishDate: s.publishDate,
      journalPublishDate: s.journalPublishDate,
      abstract: abstractExcerpt(s.abstract),
    })) as StudiesPageResponse["data"],
  };
}

export default async function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const search = new URLSearchParams(
    Object.entries(searchParams).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v ? [[k, v]] : [])),
  ).toString();
  const key = studiesQueryString(search);
  let initial: { key: string; data: StudiesPageResponse } | undefined;
  try {
    initial = { key, data: forCards(await expressJson<StudiesPageResponse>(`/api/studies?${key}`, 600)) };
  } catch {
    initial = undefined; // the client fetches it instead
  }
  return (
    <page.Shell>
      <ClientProviders>
        <WouterBridge path="/studies" search={search}>
          <StudiesContent initial={initial} />
        </WouterBridge>
      </ClientProviders>
    </page.Shell>
  );
}
