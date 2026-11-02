/**
 * Server-rendered crawl paths under the homepage design: the same popular
 * condition hubs, recent studies and latest articles the crawler homepage
 * listed (GET /api/page-data/home), so moving to the SPA design doesn't drop
 * ~50 internal links Google relied on.
 */
interface LinkItem {
  slug: string;
  title?: string;
  name?: string;
}

export interface HomeLinks {
  conditions: LinkItem[];
  recentStudies: LinkItem[];
  recentBlogs: LinkItem[];
}

function Column({ title, items, href, more }: { title: string; items: LinkItem[]; href: (i: LinkItem) => string; more: { href: string; label: string } }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold text-gray-900">{title}</h2>
      <ul className="space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.slug}>
            <a href={href(i)} className="text-teal-700 hover:underline">
              {i.title ?? i.name}
            </a>
          </li>
        ))}
      </ul>
      <a href={more.href} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
        {more.label} →
      </a>
    </section>
  );
}

export function LatestResearch({ links }: { links: HomeLinks }) {
  return (
    <div className="bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-3">
        <Column
          title="Popular Health Conditions"
          items={links.conditions.slice(0, 12)}
          href={(i) => `/explore-by-condition/${i.slug}`}
          more={{ href: "/explore-by-condition", label: "All conditions" }}
        />
        <Column
          title="Recent Research Studies"
          items={links.recentStudies}
          href={(i) => `/study/${i.slug}`}
          more={{ href: "/studies", label: "Browse all studies" }}
        />
        <Column
          title="Latest Articles"
          items={links.recentBlogs}
          href={(i) => `/blog/${i.slug}`}
          more={{ href: "/blog", label: "All articles" }}
        />
      </div>
    </div>
  );
}
