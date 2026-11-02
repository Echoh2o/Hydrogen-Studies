import { genericPage } from "@web/lib/generic-page";

// /explore-by-mechanism index. Rendered per request (CSP nonce); page data cached 10 minutes.
const page = genericPage<Record<string, never>>(() => "/explore-by-mechanism", 600);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
