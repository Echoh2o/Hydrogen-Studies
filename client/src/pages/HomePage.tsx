import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import Footer from "@/components/layout/Footer";
import { HomeContent } from "./content/HomeContent";
import SiteHeader from "@/components/layout/SiteHeader";
import JsonLd, { generateOrganizationSchema, generateFaqSchema } from "@/components/seo/JsonLd";

export default function HomePage() {
  const [, navigate] = useLocation();

  const { data: siteStats } = useQuery<{
    totalStudies: number;
    countries: number;
    humanTrials: number;
    yearsOfResearch: number;
    peerReviewedPct: number;
  }>({
    queryKey: ["/api/public-stats"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: categoryStats } = useQuery<Record<string, any>>({
    queryKey: ["/api/consumer-categories/counts"],
    staleTime: 5 * 60 * 1000,
  });


  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Hydrogen Studies - Science-Backed Hydrogen Health Research</title>
        <meta name="description" content="Explore peer-reviewed research on hydrogen therapy, hydrogen water, and molecular hydrogen health benefits. Browse hundreds of scientific studies." />
        <meta property="og:title" content="Hydrogen Studies - Science-Backed Hydrogen Health Research" />
        <meta property="og:description" content="Explore peer-reviewed research on hydrogen therapy, hydrogen water, and molecular hydrogen health benefits. Browse hundreds of scientific studies." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Hydrogen Studies - Science-Backed Hydrogen Health Research" />
        <meta name="twitter:description" content="Explore peer-reviewed research on hydrogen therapy, hydrogen water, and molecular hydrogen health benefits." />
        <link rel="canonical" href="https://hydrogenstudies.com/" />
      </Helmet>
      <JsonLd
        type="Organization"
        data={generateOrganizationSchema({
          name: "Hydrogen Studies",
          url: "https://hydrogenstudies.com",
          logo: "https://hydrogenstudies.com/logo.png",
          description: "The most comprehensive database of peer-reviewed molecular hydrogen health research. Powered by Echo Water.",
          socialLinks: ["https://echowater.com"],
        })}
      />
      <JsonLd
        type="WebSite"
        data={{
          name: "Hydrogen Studies",
          url: "https://hydrogenstudies.com",
          description: "Comprehensive database of peer-reviewed research on molecular hydrogen therapy and hydrogen water health benefits.",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://hydrogenstudies.com/search?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <SiteHeader />
      <HomeContent
        siteStats={siteStats}
        categoryStats={categoryStats}
        Link={Link}
        onSearch={(q) => navigate(`/search?search=${encodeURIComponent(q)}`)}
      />
      <Footer />
    </div>
  );
}
