import { pageByline } from "@shared/page-byline";

/**
 * "By the Hydrogen Studies Editorial Team · Last updated <date>" — same copy
 * as the Express renderer (shared/page-byline pageBylineHtml). Renders nothing
 * without a date. Plain <a> and no hooks, so it works under wouter, in Next
 * client components and in server components alike.
 */
export function PageBylineLine({ date, className = "byline text-sm text-neutral-600 mb-4" }: {
  date: unknown;
  className?: string;
}) {
  const b = pageByline(date);
  if (!b) return null;
  return (
    <p className={className}>
      By the{" "}
      <a href={b.href} className="underline hover:text-teal-700">
        {b.author}
      </a>
      {" "}· Last updated <time dateTime={b.iso}>{b.dateText}</time>
    </p>
  );
}
