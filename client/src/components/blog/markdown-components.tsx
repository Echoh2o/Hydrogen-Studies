import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import { buildEchoUrl, isEchoUrl, type EchoUtmContext } from "@shared/echo-products";
import { headingId } from "@shared/heading-id";

/** Visible text of rendered markdown children (strings, numbers, nested elements). */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in node) return textOf((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

/**
 * react-markdown element overrides for blog article bodies — the SPA twin of
 * the bot renderer's demoteH1InHtml + rewriteEchoLinksInHtml
 * (shared/content-links.ts), so browsers and crawlers get the same markup:
 *
 *  - h1 → h2: the page template renders the only H1 (the article title);
 *    generated bodies often repeat it (45/53 posts had two H1s).
 *  - h2/h3 get the same anchor id the crawler emits (shared/heading-id), so
 *    links like …#is-hydrogen-flammable land on the heading in browsers too.
 *  - echowater.com links get the canonical UTM set for this page
 *    (utm_campaign=<page_type>&utm_content=<slug>) and rel="sponsored".
 *
 * Links to retired (410) posts are already unwrapped server-side by the
 * public blog API (toPublicBlog in server/routes/blog-routes.ts).
 */
export function buildBlogMarkdownComponents(ctx: EchoUtmContext): Components {
  return {
    h1: ({ node: _node, ...props }) => <h2 {...props} />,
    h2: ({ node: _node, children, ...props }) => {
      const id = headingId(textOf(children));
      return <h2 {...props} id={id || undefined}>{children}</h2>;
    },
    h3: ({ node: _node, children, ...props }) => {
      const id = headingId(textOf(children));
      return <h3 {...props} id={id || undefined}>{children}</h3>;
    },
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
