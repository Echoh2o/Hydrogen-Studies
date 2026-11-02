import { genericPage } from "@web/lib/generic-page";

// /editorial-policy. Rendered per request (CSP nonce); page data cached 10 minutes.
const page = genericPage<Record<string, never>>(() => "/editorial-policy", 600);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
