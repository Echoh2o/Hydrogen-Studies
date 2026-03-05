import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, BookOpen, TrendingUp } from "lucide-react";

export default function ThisWeekPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/public/this-week"],
    queryFn: async () => {
      const res = await fetch("/api/public/this-week");
      if (!res.ok) throw new Error("Failed to fetch digest");
      return res.json();
    },
  });

  const latest = data?.latest;
  const archive = data?.archive || [];

  const trendingTopics = latest?.trendingTopics
    ? JSON.parse(latest.trendingTopics)
    : [];
  const notableFindings = latest?.notableFindings
    ? JSON.parse(latest.notableFindings)
    : [];

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>
          {latest?.metaTitle || "This Week in Hydrogen Research - HydrogenStudies.com"}
        </title>
        <meta
          name="description"
          content={
            latest?.metaDescription ||
            "Stay current with the latest molecular hydrogen research. Weekly digest of new studies, trending topics, and notable findings."
          }
        />
        <meta property="og:title" content={latest?.metaTitle || "This Week in Hydrogen Research"} />
        <meta property="og:description" content={latest?.metaDescription || "Weekly hydrogen research digest"} />
        <meta property="og:type" content="article" />
        <link rel="canonical" href="https://hydrogenstudies.com/this-week" />
      </Helmet>

      {/* Hero */}
      <section className="bg-primary-gradient text-white py-12 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            This Week in Hydrogen Research
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto">
            Your weekly briefing on the latest molecular hydrogen science,
            curated and analyzed by our research intelligence pipeline.
          </p>
        </div>
      </section>

      <main className="container mx-auto px-4 py-8 md:py-12">
        {isLoading ? (
          <div className="space-y-4 max-w-3xl mx-auto">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : latest ? (
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Current Digest */}
            <article>
              <header className="mb-6">
                <h2 className="text-2xl font-bold mb-2">{latest.title}</h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {latest.weekStart} to {latest.weekEnd}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {latest.studyCount} studies
                  </span>
                </div>
              </header>

              {/* Trending Topics */}
              {trendingTopics.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  <TrendingUp className="h-4 w-4 mt-1 text-muted-foreground" />
                  {trendingTopics.map((topic: string, i: number) => (
                    <Badge key={i} variant="secondary">
                      {topic}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Narrative Content */}
              <div
                className="prose prose-slate max-w-none"
                dangerouslySetInnerHTML={{ __html: latest.narrative }}
              />

              {/* Notable Findings */}
              {notableFindings.length > 0 && (
                <section className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Notable Findings</h3>
                  <div className="space-y-3">
                    {notableFindings.map((f: any, i: number) => (
                      <Card key={i}>
                        <CardContent className="py-4">
                          <Link
                            href={`/studies/${f.studyId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {f.title}
                          </Link>
                          <p className="text-sm text-muted-foreground mt-1">
                            {f.finding}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}
            </article>

            {/* Archive */}
            {archive.length > 1 && (
              <section className="border-t pt-8">
                <h3 className="text-lg font-semibold mb-4">Past Digests</h3>
                <div className="space-y-2">
                  {archive
                    .filter((d: any) => d.id !== latest.id)
                    .map((digest: any) => (
                      <Link
                        key={digest.id}
                        href={`/this-week?slug=${digest.slug}`}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
                      >
                        <span className="font-medium">{digest.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {digest.studyCount} studies
                        </span>
                      </Link>
                    ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="text-center py-16">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Digest Available Yet</h2>
            <p className="text-muted-foreground">
              Our research intelligence pipeline is working on collecting and
              analyzing the latest hydrogen research. Check back soon!
            </p>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}
