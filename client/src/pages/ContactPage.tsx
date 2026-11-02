import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import JsonLd, { generateFaqSchema } from "@/components/seo/JsonLd";
import { ContactContent } from "./content/ContactContent";
import { CONTACT_FAQS } from "./content/contact-faqs";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <SiteHeader />
      <Helmet>
        <title>Contact Us - Hydrogen Studies</title>
        <meta name="description" content="Get in touch with the Hydrogen Studies team. Ask questions about hydrogen research, suggest studies, or provide feedback." />
        <meta property="og:title" content="Contact Us - Hydrogen Studies" />
        <meta property="og:description" content="Get in touch with the Hydrogen Studies team. Ask questions about hydrogen research, suggest studies, or provide feedback." />
        <link rel="canonical" href="https://hydrogenstudies.com/contact" />
      </Helmet>
      <JsonLd type="FAQPage" data={generateFaqSchema(CONTACT_FAQS)} />

      <ContactContent />

      <Footer />
    </div>
  );
}
