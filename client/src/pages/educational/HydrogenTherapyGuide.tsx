import React from "react";
import { Helmet } from "react-helmet";
import JsonLd, { generateFaqSchema } from "@/components/seo/JsonLd";
import { THERAPY_GUIDE_FAQS } from "@shared/learn-faqs";
import { HydrogenTherapyGuideContent } from "../content/HydrogenTherapyGuideContent";

// Head + structured data for the SPA route; the body is shared with the Next
// page (web/app/learn/therapy-guide). FAQPage only: the FAQ is on the page.
// The former Article block (author/dates nobody can see) was dropped —
// schema only for what's visible (CLAUDE.md).
const HydrogenTherapyGuide = () => {
  return (
    <>
      <Helmet>
        <title>
          Molecular Hydrogen Therapy: What the Research Shows | Hydrogen
          Studies
        </title>
        <meta
          name="description"
          content="What researchers call molecular hydrogen therapy, how hydrogen is given (water, inhalation, baths), and what the evidence does — and doesn't — show."
        />
        <meta
          name="keywords"
          content="molecular hydrogen therapy, hydrogen water research, hydrogen gas inhalation, hydrogen therapy research"
        />
        <link
          rel="canonical"
          href="https://hydrogenstudies.com/learn/therapy-guide"
        />

        {/* Open Graph Tags */}
        <meta
          property="og:title"
          content="Molecular Hydrogen Therapy: What the Research Shows"
        />
        <meta
          property="og:description"
          content="How hydrogen is studied, how it's given, and what the evidence does — and doesn't — show."
        />
        <meta property="og:type" content="article" />
        <meta
          property="og:url"
          content="https://hydrogenstudies.com/learn/therapy-guide"
        />
        <meta property="og:image" content="/og-hydrogen-therapy-guide.jpg" />

        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Molecular Hydrogen Therapy: What the Research Shows"
        />
        <meta
          name="twitter:description"
          content="How hydrogen is studied, how it's given, and what the evidence does — and doesn't — show."
        />
      </Helmet>

      <JsonLd type="FAQPage" data={generateFaqSchema(THERAPY_GUIDE_FAQS)} />

      <HydrogenTherapyGuideContent />
    </>
  );
};

export default HydrogenTherapyGuide;
