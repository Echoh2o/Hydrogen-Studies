import { genericPage } from "@web/lib/generic-page";

// /journals — journals with ≥10 hydrogen studies (PLAN 4.7). Page data cached an hour.
const page = genericPage<Record<string, never>>(() => "/journals", 3600);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;
export default page.Page;
