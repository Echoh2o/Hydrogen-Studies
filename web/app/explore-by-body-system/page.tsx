import { genericPage } from "@web/lib/generic-page";

// /explore-by-body-system index. Rendered per request (not at build: Express isn't reachable from
// the build container); the Express renderer caches its own queries.
const page = genericPage<Record<string, never>>(() => "/explore-by-body-system", 0);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
