import { genericPage } from "@web/lib/generic-page";

// Blog post — same body crawlers indexed, now for everyone (ISR hourly).
const page = genericPage<{ slug: string }>((p) => `/blog/${p.slug}`, 3600);

export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}
export const generateMetadata = page.generateMetadata;
export default page.Page;
