import { genericPage } from "@web/lib/generic-page";

// /explore-by-condition hub (unknown hubs 404 via the renderer).
const page = genericPage<{ slug: string }>((p) => `/explore-by-condition/${p.slug}`, 3600);

// Rendered per request (CSP nonce); page data cached for an hour.
export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
