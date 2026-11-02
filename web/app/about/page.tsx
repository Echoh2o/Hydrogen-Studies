import { AboutContent } from "@/pages/content/AboutContent";
import { contentPage } from "@web/lib/content-page";

// Same body component as the SPA page; meta from Express (what crawlers get).
const page = contentPage("/about");

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;

export default function Page() {
  return (
    <page.Shell className="">
      <AboutContent />
    </page.Shell>
  );
}
