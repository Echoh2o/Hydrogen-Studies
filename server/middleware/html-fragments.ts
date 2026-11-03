/**
 * HTML fragments shared by the page renderers (seo-body-renderer.ts,
 * profile-pages.ts): escaping, the visible breadcrumb trail (whose labels the
 * BreadcrumbList JSON-LD mirrors) and the site footer.
 */
import { LAST_CRUMB_MAX, truncateLabel } from "../../shared/breadcrumbs";
import { ECHOWATER_ORIGIN } from "../../shared/echo-products";

/** The evidence-graded benefits guide the footer links (also in web/components/SiteFooter.tsx). */
const BENEFITS_GUIDE_PATH = "/blog/molecular-hydrogen-benefits-guide-pillar";

export function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Same rule as the BreadcrumbList names (shared/breadcrumbs.ts). */
export function truncate(str: string, max: number): string {
  return truncateLabel(str, max);
}

export function breadcrumbs(items: { label: string; href?: string }[]): string {
  const lis = items.map((item, i) => {
    const isLast = i === items.length - 1;
    if (item.href && !isLast) {
      return `<li><a href="${esc(item.href)}">${esc(item.label)}</a></li>`;
    }
    return `<li aria-current="page">${esc(truncate(item.label, LAST_CRUMB_MAX))}</li>`;
  });
  return `<nav aria-label="Breadcrumb"><ol>${lis.join("")}</ol></nav>\n`;
}

export function footer(conditions: { name: string; slug: string }[]): string {
  let h = `\n<footer>\n<nav>\n`;
  h += `<section><h3>Research Database</h3><ul>`;
  h += `<li><a href="/">Home</a></li>`;
  h += `<li><a href="/studies">All Studies</a></li>`;
  h += `<li><a href="/blog">Blog</a></li>`;
  h += `<li><a href="/researchers">Researchers</a></li>`;
  h += `<li><a href="/journals">Journals</a></li>`;
  h += `<li><a href="/search">Search</a></li>`;
  h += `<li><a href="/advanced-search">Advanced Search</a></li>`;
  h += `</ul></section>`;

  h += `<section><h3>Browse Research</h3><ul>`;
  h += `<li><a href="/explore-by-condition">By Health Condition</a></li>`;
  h += `<li><a href="/explore-by-body-system">By Body System</a></li>`;
  h += `<li><a href="/explore-by-mechanism">By Mechanism</a></li>`;
  h += `<li><a href="/explore-by-delivery-method">By Delivery Method</a></li>`;
  h += `<li><a href="/explore-by-life-stage">By Life Stage</a></li>`;
  h += `<li><a href="/explore-by-benefit">By Benefit</a></li>`;
  h += `</ul></section>`;

  if (conditions.length > 0) {
    h += `<section><h3>Popular Conditions</h3><ul>`;
    for (const c of conditions.slice(0, 12)) {
      h += `<li><a href="/explore-by-condition/${esc(c.slug)}">${esc(c.name)}</a></li>`;
    }
    h += `</ul></section>`;
  }

  h += `<section><h3>Learn</h3><ul>`;
  h += `<li><a href="/learn/basics">Hydrogen Basics</a></li>`;
  h += `<li><a href="/learn/health-benefits">Health Benefits</a></li>`;
  h += `<li><a href="/learn/therapy-guide">Therapy Guide</a></li>`;
  h += `<li><a href="${BENEFITS_GUIDE_PATH}">Hydrogen water benefits (evidence-graded)</a></li>`;
  h += `</ul></section>`;

  h += `<section><h3>Company</h3><ul>`;
  h += `<li><a href="/about">About</a></li>`;
  h += `<li><a href="/contact">Contact</a></li>`;
  h += `<li><a href="/privacy">Privacy Policy</a></li>`;
  h += `<li><a href="/terms">Terms of Service</a></li>`;
  h += `</ul></section>`;

  h += `\n</nav>\n`;
  // Ownership disclosure (PLAN.md 0.3, Appendix B) — must appear in crawler
  // output on every page, same as the browser footer. The href is tagged with
  // the page's own utm_campaign/utm_content by renderPageBody's UTM rewriter.
  // No product links here (Appendix E: the footer is on disease pages too).
  h += `<p>Hydrogen Studies is built and funded by Echo Technologies LLC, the maker of `;
  h += `<a href="${ECHOWATER_ORIGIN}/" rel="sponsored noopener">Echo Water</a> hydrogen products. `;
  h += `Our research team selects and summarizes studies independently; Echo does not decide which studies are included or how they are described. `;
  h += `<a href="/editorial-policy">Editorial policy</a> · <a href="/methodology">Methodology</a> · <a href="/contact">Contact</a></p>\n`;
  h += `<p>&copy; ${new Date().getFullYear()} Hydrogen Studies. Evidence-based hydrogen therapy research database.</p>\n`;
  h += `</footer>`;
  return h;
}
