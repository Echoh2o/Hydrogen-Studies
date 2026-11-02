import { genericPage } from "@web/lib/generic-page";

// /methodology. Rendered per request (not at build: Express isn't reachable from
// the build container); the Express renderer caches its own queries.
const page = genericPage<Record<string, never>>(() => "/methodology", 0);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
