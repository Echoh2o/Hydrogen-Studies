import { genericPage } from "@web/lib/generic-page";

// /explore-by-mechanism hub (ISR hourly; unknown hubs 404 via the renderer).
const page = genericPage<{ slug: string }>((p) => `/explore-by-mechanism/${p.slug}`, 3600);

export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}
export const generateMetadata = page.generateMetadata;
export default page.Page;
