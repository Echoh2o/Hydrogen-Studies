import { genericPage } from "@web/lib/generic-page";

// /hydrogen-for topic page (ISR hourly).
const page = genericPage<{ topic: string }>((p) => `/hydrogen-for/${p.topic}`, 3600);

export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}
export const generateMetadata = page.generateMetadata;
export default page.Page;
