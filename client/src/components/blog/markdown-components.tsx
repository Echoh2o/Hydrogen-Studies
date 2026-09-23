import type { Components } from "react-markdown";
import { buildEchoUrl, isEchoUrl, type EchoUtmContext } from "@shared/echo-products";

/**
 * react-markdown element overrides for blog article bodies — the SPA twin of
 * the bot renderer's demoteH1InHtml + rewriteEchoLinksInHtml
 * (shared/content-links.ts), so browsers and crawlers get the same markup:
 *
 *  - h1 → h2: the page template renders the only H1 (the article title);
 *    generated bodies often repeat it (45/53 posts had two H1s).
 *  - echowater.com links get the canonical UTM set for this page
 *    (utm_campaign=<page_type>&utm_content=<slug>) and rel="sponsored".
 *
 * Links to retired (410) posts are already unwrapped server-side by the
 * public blog API (toPublicBlog in server/routes/blog-routes.ts).
 */
export function buildBlogMarkdownComponents(ctx: EchoUtmContext): Components {
  return {
    h1: ({ node: _node, ...props }) => <h2 {...props} />,
    a: ({ node: _node, href, ...props }) => {
      if (href && isEchoUrl(href)) {
        return (
          <a
            {...props}
            href={buildEchoUrl(href, ctx)}
            target="_blank"
            rel="sponsored noopener"
          />
        );
      }
      return <a {...props} href={href} />;
    },
  };
}
