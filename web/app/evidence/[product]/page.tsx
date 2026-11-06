import { genericPage } from "@web/lib/generic-page";

// /evidence/:product (TRUST-BADGE-PLAN 1.5) — the evidence profile behind the
// echowater.com badge; noindex at launch. Numbers refresh with the page data (10 min).
const page = genericPage<{ product: string }>((p) => `/evidence/${p.product}`, 600);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
