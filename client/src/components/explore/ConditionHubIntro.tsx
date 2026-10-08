import { useMemo } from "react";
import Markdown from "react-markdown";
import { buildBlogMarkdownComponents } from "@/components/blog/markdown-components";
import { Byline } from "@/components/blog/Byline";
import { useEchoPageContext } from "@/hooks/use-echo-link";
import {
  CONDITION_HUB_FAQ_HEADING,
  CONDITION_HUB_OWNER_GUIDE_LEAD,
  CONDITION_HUB_SOURCES_HEADING,
  conditionHubByline,
  conditionHubSourceId,
  conditionHubSourceLinks,
  type ConditionHubIntro as ConditionHubIntroRecord,
} from "@shared/condition-hub-intros";

/**
 * Evidence-graded condition-hub intro (shared/condition-hub-intros.ts) — the
 * SPA twin of seo-body-renderer renderConditionHubIntroHtml: H1, byline
 * ("Updated" — no named reviewer), the intro through the blog markdown
 * renderer (body "# " headings demoted, so the H1 stays unique), the visible
 * FAQ that the page's FAQPage JSON-LD describes, and the numbered sources the
 * intro's "[n]" refs point to.
 */
export function ConditionHubIntro({ intro }: { intro: ConditionHubIntroRecord }) {
  const echoCtx = useEchoPageContext();
  const markdownComponents = useMemo(() => buildBlogMarkdownComponents(echoCtx), [echoCtx]);
  const byline = conditionHubByline(intro);

  return (
    <article className="max-w-3xl mx-auto mb-12">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-primary mb-3">{intro.h1}</h1>
        <Byline byline={byline} />
      </header>

      <div className="hub-intro prose prose-neutral max-w-none">
        <Markdown components={markdownComponents}>{intro.introMarkdown}</Markdown>
      </div>

      {intro.faqs.length > 0 && (
        <section aria-labelledby="faq" className="mt-10">
          <h2 id="faq" className="text-2xl font-bold mb-4">{CONDITION_HUB_FAQ_HEADING}</h2>
          {intro.faqs.map((faq) => (
            <div key={faq.question} className="mb-5">
              <h3 className="text-lg font-semibold mb-1">{faq.question}</h3>
              <p className="text-neutral-700">{faq.answer}</p>
            </div>
          ))}
        </section>
      )}

      {intro.sources.length > 0 && (
        <section aria-labelledby="sources" className="mt-10">
          <h2 id="sources" className="text-2xl font-bold mb-4">{CONDITION_HUB_SOURCES_HEADING}</h2>
          <ol className="list-decimal pl-6 space-y-2 text-sm text-neutral-700">
            {intro.sources.map((source) => (
              <li key={source.n} id={conditionHubSourceId(source.n)}>
                {source.citation}
                {conditionHubSourceLinks(source).map((link, i) => (
                  <span key={link.href}>
                    {i === 0 ? " " : " · "}
                    {link.external ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className="underline hover:text-teal-700">
                        {link.label}
                      </a>
                    ) : (
                      <a href={link.href} className="underline hover:text-teal-700">
                        {link.label}
                      </a>
                    )}
                  </span>
                ))}
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}

/** "Read the full guide: <owner page>" — after the study list. */
export function ConditionHubOwnerGuide({ intro }: { intro: ConditionHubIntroRecord }) {
  return (
    <section className="owner-guide max-w-3xl mx-auto mt-10 rounded-lg border border-neutral-200 bg-neutral-50 p-5">
      <p>
        <strong>{CONDITION_HUB_OWNER_GUIDE_LEAD}</strong>{" "}
        <a href={intro.ownerLink.href} className="text-primary underline hover:text-primary/80">
          {intro.ownerLink.label}
        </a>
      </p>
    </section>
  );
}
