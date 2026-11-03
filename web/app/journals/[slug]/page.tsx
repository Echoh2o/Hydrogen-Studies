import { genericPage } from "@web/lib/generic-page";

// /journals/<slug> — one journal's hydrogen studies (unknown slugs 404 via the renderer).
const page = genericPage<{ slug: string }>((p) => `/journals/${p.slug}`, 3600);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
