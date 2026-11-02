import { genericPage } from "@web/lib/generic-page";

// /hydrogen-for topic page (data cached hourly).
const page = genericPage<{ topic: string }>((p) => `/hydrogen-for/${p.topic}`, 3600);

// Rendered per request (CSP nonce); page data cached for an hour.
export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
