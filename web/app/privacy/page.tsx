import { PrivacyContent } from "@/pages/content/PrivacyContent";
import { contentPage } from "@web/lib/content-page";

// Same body component as the SPA page; meta from Express (what crawlers get).
const page = contentPage("/privacy");

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;

export default function Page() {
  return (
    <page.Shell className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <PrivacyContent />
    </page.Shell>
  );
}
