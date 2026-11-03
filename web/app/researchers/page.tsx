import { genericPage } from "@web/lib/generic-page";

// /researchers — authors with ≥8 studies (PLAN 4.7). Page data cached an hour.
const page = genericPage<Record<string, never>>(() => "/researchers", 3600);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
