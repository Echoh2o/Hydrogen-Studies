import type { Metadata } from "next";
import { headers } from "next/headers";
import { Montserrat } from "next/font/google";
import "../../client/src/index.css";
import "./content.css";
import { Analytics } from "@web/components/Analytics";

const ORGANIZATION_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://hydrogenstudies.com/#organization",
  name: "Hydrogen Studies",
  url: "https://hydrogenstudies.com/",
  logo: "https://hydrogenstudies.com/logo.png",
  description: "Evidence-graded database and living reviews of peer-reviewed molecular hydrogen research.",
  parentOrganization: { "@type": "Organization", name: "Echo Technologies LLC", url: "https://echowater.com" },
  funder: { "@type": "Organization", name: "Echo Technologies LLC", url: "https://echowater.com" },
};

const WEBSITE_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://hydrogenstudies.com/#website",
  url: "https://hydrogenstudies.com/",
  name: "Hydrogen Studies",
  publisher: { "@id": "https://hydrogenstudies.com/#organization" },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: "https://hydrogenstudies.com/improved-search?query={search_term_string}" },
    "query-input": "required name=search_term_string",
  },
};

// Self-hosted at build (no render-blocking request to fonts.googleapis.com)
// with a size-matched fallback, so the swap doesn't reflow text (CLS).
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hydrogenstudies.com"),
  icons: { icon: [{ url: "/favicon.ico", sizes: "48x48" }, { url: "/favicon.svg", type: "image/svg+xml" }] },
  alternates: { types: { "application/rss+xml": "/rss.xml" } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the request makes every page render per request, so each gets a
  // fresh CSP nonce (web/middleware.ts). Page data stays cached (fetch
  // revalidate), so this costs a React render, not a database round trip.
  headers().get("x-nonce");
  return (
    <html lang="en" className={montserrat.variable}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_LD) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_LD) }} />
      </head>
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
