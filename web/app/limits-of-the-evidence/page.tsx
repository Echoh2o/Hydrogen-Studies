import { genericPage } from "@web/lib/generic-page";

// /limits-of-the-evidence (PLAN 4.6) — numbers are recomputed when the page data refreshes (10 min).
const page = genericPage<Record<string, never>>(() => "/limits-of-the-evidence", 600);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
