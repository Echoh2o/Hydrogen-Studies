import { genericPage } from "@web/lib/generic-page";

// /is-hydrogen-water-a-scam (PLAN 4.6) — numbers recomputed when the page data refreshes (10 min).
const page = genericPage<Record<string, never>>(() => "/is-hydrogen-water-a-scam", 600);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
