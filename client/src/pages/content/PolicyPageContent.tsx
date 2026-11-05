// Body of /editorial-policy and /methodology for the SPA routes — the same
// shared/policy-pages.ts text the server renderer serves to every visitor.
import { headingId } from "@shared/heading-id";
import Markdown from "react-markdown";
import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import type { PolicyPage } from "@shared/policy-pages";
import { EDITORIAL_TEAM, formatLongDate } from "@shared/seo-markup";

export function PolicyPageContent({ page, icon: Icon }: { page: PolicyPage; icon: LucideIcon }) {
  return (
    <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <Card className="p-8 shadow-lg bg-white">
        <div className="flex items-center mb-4">
          <Icon className="h-10 w-10 text-teal-600 mr-4" />
          <h1 className="text-3xl font-bold text-gray-900">{page.h1}</h1>
        </div>
        <p className="byline text-sm text-gray-600 mb-6">
          By <a href="/editorial-policy" className="underline">{EDITORIAL_TEAM}</a> · Updated{" "}
          <time dateTime={page.lastUpdated}>{formatLongDate(page.lastUpdated)}</time>
        </p>
        <p className="lead text-lg text-gray-700 mb-8">{page.intro}</p>
        <div className="prose prose-gray max-w-none">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2 id={headingId(section.heading)} className="text-xl font-semibold text-gray-900 mt-8 mb-3">{section.heading}</h2>
              <Markdown>{section.markdown}</Markdown>
            </section>
          ))}
        </div>
      </Card>
    </main>
  );
}
