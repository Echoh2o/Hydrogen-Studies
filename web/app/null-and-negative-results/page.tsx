import { genericPage } from "@web/lib/generic-page";

// /null-and-negative-results (PLAN 4.6) — studies with a neutral, negative or mixed recorded outcome.
const page = genericPage<Record<string, never>>(() => "/null-and-negative-results", 600);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
