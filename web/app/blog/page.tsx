import { genericPage } from "@web/lib/generic-page";

// Blog index. Rendered per request (not at build: Express isn't reachable from
// the build container); the Express renderer caches its own queries.
const page = genericPage<Record<string, never>>(() => "/blog", 0);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
