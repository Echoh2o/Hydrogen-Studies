import { revalidateTag } from "next/cache";
import { PAGE_DATA_TAG } from "@web/lib/page-data";

/**
 * Express calls this when content changes (seo-bot-middleware
 * invalidateBotCache → notifyWebRevalidate): drops the cached page data for
 * those paths so admin edits show on the next request. No paths = all pages.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const key = process.env.PAGE_DATA_KEY;
  if (!key || req.headers.get("x-page-data-key") !== key) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { paths?: unknown };
  const paths = Array.isArray(body.paths) ? body.paths.filter((p): p is string => typeof p === "string" && p.startsWith("/")) : [];
  if (paths.length === 0) {
    revalidateTag(PAGE_DATA_TAG);
    return Response.json({ revalidated: "all" });
  }
  for (const p of paths) revalidateTag(p);
  return Response.json({ revalidated: paths });
}
