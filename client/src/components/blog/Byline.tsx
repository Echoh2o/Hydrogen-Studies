import { Link } from "wouter";
import { isoDate, type BlogByline } from "@shared/seo-markup";

/**
 * Visible byline — same copy as the bot renderer (seo-body-renderer
 * renderBylineHtml): "By {author}[ · Reviewed by X] · {Updated|Last reviewed}
 * {date}". The label/date rules live in shared/seo-markup blogByline().
 */
export function Byline({ byline, className = "byline text-sm text-neutral-600 mb-2" }: {
  byline: BlogByline;
  className?: string;
}) {
  return (
    <p className={className}>
      By{" "}
      <Link href={byline.href} className="underline hover:text-teal-700">
        {byline.author}
      </Link>
      {byline.reviewer && <> · Reviewed by {byline.reviewer}</>}
      {byline.date && (
        <>
          {" "}· {byline.dateLabel}{" "}
          <time dateTime={isoDate(byline.date)}>{byline.dateText}</time>
        </>
      )}
    </p>
  );
}
