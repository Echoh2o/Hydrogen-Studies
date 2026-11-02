import { ContactContent } from "@/pages/content/ContactContent";
import { CONTACT_FAQS } from "@/pages/content/contact-faqs";
import { contentPage } from "@web/lib/content-page";
import { ClientProviders } from "@web/components/ClientProviders";

// The FAQ is visible on the page (ContactContent), so FAQPage schema is allowed.
const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: CONTACT_FAQS.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  })),
};

const page = contentPage("/contact", [FAQ_LD]);

export const dynamic = "force-dynamic";
export const generateMetadata = page.generateMetadata;

export default function Page() {
  return (
    <page.Shell className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <ClientProviders>
        <ContactContent />
      </ClientProviders>
    </page.Shell>
  );
}
