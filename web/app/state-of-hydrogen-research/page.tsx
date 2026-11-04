import { genericPage } from "@web/lib/generic-page";

// /state-of-hydrogen-research (PLAN 6.2) — live figures; page data refreshes every 10 min.
const page = genericPage<Record<string, never>>(() => "/state-of-hydrogen-research", 600);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
