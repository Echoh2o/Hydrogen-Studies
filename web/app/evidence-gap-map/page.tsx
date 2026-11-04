import { genericPage } from "@web/lib/generic-page";

// /evidence-gap-map (PLAN 6.3) — condition × evidence-type matrix; page data refreshes every 10 min.
const page = genericPage<Record<string, never>>(() => "/evidence-gap-map", 600);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
