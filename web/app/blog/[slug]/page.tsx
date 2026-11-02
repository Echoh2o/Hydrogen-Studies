import { genericPage } from "@web/lib/generic-page";

// Blog post — same body crawlers indexed, now for everyone (data cached hourly).
const page = genericPage<{ slug: string }>((p) => `/blog/${p.slug}`, 3600);

// Rendered per request (CSP nonce); page data cached for an hour.
export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
