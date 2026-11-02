import { genericPage } from "@web/lib/generic-page";

// /methodology. Rendered per request (CSP nonce); page data cached 10 minutes.
const page = genericPage<Record<string, never>>(() => "/methodology", 600);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
