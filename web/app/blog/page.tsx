import { genericPage } from "@web/lib/generic-page";

// Blog index. Rendered per request (CSP nonce); page data cached 10 minutes.
const page = genericPage<Record<string, never>>(() => "/blog", 600);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
