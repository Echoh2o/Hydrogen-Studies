import { buildEchoUrl, ECHOWATER_ORIGIN } from "@shared/echo-products";
import type { FooterCondition } from "@web/lib/page-data";

const BENEFITS_GUIDE_PATH = "/blog/molecular-hydrogen-benefits-guide-pillar";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Research Database",
    links: [
      { href: "/", label: "Home" },
      { href: "/studies", label: "All Studies" },
      { href: "/blog", label: "Blog" },
      { href: "/researchers", label: "Researchers" },
      { href: "/journals", label: "Journals" },
      { href: "/search", label: "Search" },
      { href: "/advanced-search", label: "Advanced Search" },
    ],
  },
  {
    title: "Browse Research",
    links: [
      { href: "/explore-by-condition", label: "By Health Condition" },
      { href: "/explore-by-body-system", label: "By Body System" },
      { href: "/explore-by-mechanism", label: "By Mechanism" },
      { href: "/explore-by-delivery-method", label: "By Delivery Method" },
      { href: "/explore-by-life-stage", label: "By Life Stage" },
      { href: "/explore-by-benefit", label: "By Benefit" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/learn/basics", label: "Hydrogen Basics" },
      { href: "/learn/health-benefits", label: "Health Benefits" },
      { href: "/learn/therapy-guide", label: "Therapy Guide" },
      { href: BENEFITS_GUIDE_PATH, label: "Hydrogen water benefits (evidence-graded)" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
];

/**
 * Same links and ownership disclosure as the crawler footer
 * (seo-body-renderer.ts footer()). No product links: the footer is on disease
 * pages too (PLAN Appendix E).
 */
export function SiteFooter({
  conditions,
  pageType,
  slug,
}: {
  conditions: FooterCondition[];
  pageType: string;
  slug: string;
}) {
  const echoHref = buildEchoUrl(`${ECHOWATER_ORIGIN}/`, { pageType, slug });
  const columns = [...COLUMNS];
  if (conditions.length) {
    columns.splice(2, 0, {
      title: "Popular Conditions",
      links: conditions.slice(0, 12).map((c) => ({ href: `/explore-by-condition/${c.slug}`, label: c.name })),
    });
  }
  return (
    <footer className="mt-16 bg-neutral-900 text-neutral-300">
      <div className="container mx-auto px-4 py-12">
        <nav className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5" aria-label="Footer">
          {columns.map((col) => (
            <section key={col.title}>
              <h3 className="mb-3 text-sm font-semibold text-white">{col.title}</h3>
              <ul className="space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="hover:text-white">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
        <p className="mt-10 max-w-3xl text-sm">
          Hydrogen Studies is built and funded by Echo Technologies LLC, the maker of{" "}
          <a href={echoHref} rel="sponsored noopener" className="text-primary underline">
            Echo Water
          </a>{" "}
          hydrogen products. Our research team selects and summarizes studies independently; Echo does not decide which
          studies are included or how they are described.{" "}
          <a href="/editorial-policy" className="underline">Editorial policy</a> ·{" "}
          <a href="/methodology" className="underline">Methodology</a> · <a href="/contact" className="underline">Contact</a>
        </p>
        <p className="mt-4 text-xs text-neutral-500">
          © {new Date().getFullYear()} Hydrogen Studies. Evidence-based hydrogen therapy research database.
        </p>
      </div>
    </footer>
  );
}
