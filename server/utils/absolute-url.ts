/**
 * Absolute-URL helper for SEO surfaces.
 *
 * Social crawlers (Facebook/Twitter/LinkedIn/Slack) and Google image
 * sitemaps silently drop relative URLs, so og:image / twitter:image /
 * <image:loc> values must always be absolute. Route every image URL that
 * reaches those surfaces through this helper.
 */
export function toAbsoluteUrl(url: string, base: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  const origin = base.replace(/\/+$/, "");
  return url.startsWith("/") ? `${origin}${url}` : `${origin}/${url}`;
}
