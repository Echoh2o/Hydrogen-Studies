import { genericPage } from "@web/lib/generic-page";

// /dataset (PLAN 6.2) — the open dataset page; the CSV/JSON downloads are Express routes.
const page = genericPage<Record<string, never>>(() => "/dataset", 600);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
