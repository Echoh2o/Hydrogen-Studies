import React from "react";
import { Link, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Calendar,
  User,
  Clock,
  Tag,
  Share2,
  BookOpen,
  Heart,
  MessageCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import SiteHeader from "@/components/layout/SiteHeader";

export default function BlogArticlePage() {
  const { id } = useParams();

  // This would normally fetch from your database
  const article = {
    id: parseInt(id || "1"),
    title: "Top 5 Hydrogen Studies on Gut Health: What the Research Shows",
    summary:
      "A comprehensive analysis of the latest research on hydrogen therapy for digestive health and gut microbiome support.",
    content: `
# Introduction

The relationship between hydrogen therapy and gut health has emerged as one of the most fascinating areas of research in molecular medicine. With over 85 peer-reviewed studies examining this connection, we're beginning to understand how this simple molecule may support digestive wellness and microbiome balance.

## Key Research Findings

### 1. Inflammatory Bowel Disease Support

Recent studies have shown promising results for hydrogen water in managing inflammatory bowel conditions. A 2023 clinical trial published in the *Journal of Gastroenterology* followed 48 patients with ulcerative colitis who consumed hydrogen-rich water for 8 weeks.

**Key Results:**
- 72% reduction in inflammatory markers
- Significant improvement in symptom scores
- Better quality of life measures
- No adverse effects reported

### 2. Microbiome Balance

Research from Tokyo Medical University demonstrated that hydrogen water consumption can positively influence gut bacteria composition. The study tracked changes in beneficial bacteria populations over a 12-week period.

**Microbiome Changes Observed:**
- Increased *Bifidobacterium* levels (45% increase)
- Higher *Lactobacillus* populations (38% increase)
- Reduced pathogenic bacteria
- Improved overall microbiome diversity

### 3. Digestive Comfort

Multiple studies have examined hydrogen's effects on common digestive discomforts. A double-blind, placebo-controlled trial with 120 participants showed significant improvements in:

- Bloating and gas (68% improvement)
- Digestive regularity (54% improvement)
- Overall gut comfort (71% improvement)
- Reduced digestive inflammation markers

### 4. Gut Barrier Function

The intestinal barrier plays a crucial role in overall health. Research has shown that hydrogen therapy may support the integrity of this important barrier through:

- Enhanced tight junction proteins
- Reduced intestinal permeability
- Improved mucus layer thickness
- Better immune function regulation

### 5. Antioxidant Effects in the Digestive System

The gut faces constant oxidative stress from food processing and bacterial activity. Studies demonstrate that hydrogen's selective antioxidant properties may:

- Neutralize harmful free radicals in the digestive tract
- Protect intestinal cells from oxidative damage
- Support natural healing processes
- Maintain healthy inflammation levels

## Practical Applications

Based on current research, here are evidence-based approaches to using hydrogen for gut health:

### Dosage and Timing
- **Hydrogen Water:** 1-2 liters daily, preferably between meals
- **Duration:** Most studies show benefits after 4-8 weeks of consistent use
- **Timing:** Morning consumption may optimize absorption

### Quality Considerations
When choosing hydrogen products for gut health:
- Look for products with proven hydrogen concentration
- Choose reputable manufacturers with third-party testing
- Consider dissolution methods that maintain hydrogen levels
- Ensure proper storage to preserve therapeutic benefits

## Expert Insights

*"The emerging research on hydrogen and gut health is particularly exciting because it addresses the root causes of digestive issues rather than just managing symptoms,"* says Dr. Sarah Chen, a gastroenterologist specializing in integrative approaches.

*"What we're seeing is that hydrogen works synergistically with the body's natural healing mechanisms, supporting the gut microbiome while reducing harmful inflammation."*

## Future Research Directions

Ongoing studies are exploring:
- Optimal dosing protocols for different conditions
- Combination therapies with probiotics
- Long-term safety and efficacy data
- Mechanisms of action at the cellular level
- Personalized approaches based on microbiome analysis

## Conclusion

The research on hydrogen therapy for gut health continues to grow, with promising results across multiple areas of digestive wellness. While individual results may vary, the scientific evidence suggests that hydrogen therapy could be a valuable tool for supporting gut health naturally.

As always, consult with healthcare professionals before starting any new health regimen, especially if you have existing digestive conditions or take medications.

## Related Studies

For those interested in diving deeper into the research, here are key studies referenced:

1. *"Hydrogen-rich water reduces inflammatory response in the gut"* - Journal of Gastroenterology (2023)
2. *"Effects of hydrogen water on gut microbiome diversity"* - Microbiome Research (2023)
3. *"Clinical efficacy of hydrogen therapy in IBD patients"* - Digestive Diseases and Sciences (2022)
4. *"Hydrogen's impact on intestinal barrier function"* - Gut Health Journal (2023)
5. *"Antioxidant effects of molecular hydrogen in digestive health"* - Free Radical Biology (2022)
    `,
    author: "Dr. Sarah Chen",
    authorBio:
      "Dr. Chen is a board-certified gastroenterologist with over 15 years of experience in integrative digestive health. She specializes in hydrogen therapy research and has published over 30 peer-reviewed articles.",
    publishDate: "2024-01-15",
    readTime: "8 min read",
    category: "Research Insights",
    imageUrl:
      "https://placehold.co/800x400/e2f3ff/003366?text=Gut+Health+Research",
    tags: [
      "gut health",
      "microbiome",
      "research analysis",
      "digestive health",
      "hydrogen water",
    ],
    relatedStudies: [542, 678, 923, 1045, 1156],
  };

  const relatedArticles = [
    {
      id: 2,
      title:
        "How Athletes Are Using Hydrogen Water for Performance Enhancement",
      category: "Product Applications",
      readTime: "6 min read",
    },
    {
      id: 3,
      title: "Understanding Hydrogen Inhalation Therapy: A Beginner's Guide",
      category: "Health Benefits",
      readTime: "10 min read",
    },
    {
      id: 4,
      title: "The Science Behind Hydrogen's Anti-Inflammatory Effects",
      category: "Research Insights",
      readTime: "7 min read",
    },
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const { toast } = useToast();

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.summary,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: "Article link has been copied to your clipboard.",
      });
    }
  };

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-white">
        {/* Back Navigation - removed sticky nav since we have SiteHeader */}
        <div className="bg-white border-b">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link
              href="/blog"
              className="flex items-center text-teal-600 hover:text-teal-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Blog
            </Link>
          </div>
        </div>

        {/* Article Header */}
        <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <header className="mb-8">
            <div className="flex items-center space-x-4 mb-6">
              <Badge className="bg-teal-100 text-teal-800">
                {article.category}
              </Badge>
              <div className="flex items-center text-gray-500 text-sm space-x-4">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {formatDate(article.publishDate)}
                </div>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {article.readTime}
                </div>
              </div>
            </div>

            <h1 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
              {article.title}
            </h1>

            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              {article.summary}
            </p>

            <div className="flex items-center justify-between pb-8 border-b">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-teal-600 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {article.author}
                  </p>
                  <p className="text-sm text-gray-600">
                    Medical Expert & Researcher
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleShare}
                className="flex items-center"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </header>

          {/* Featured Image */}
          <div className="mb-8">
            <img
              src={article.imageUrl}
              alt={article.title}
              className="w-full h-64 sm:h-80 object-cover rounded-lg"
            />
          </div>

          {/* Article Content */}
          <div className="prose prose-lg max-w-none">
            {article.content.split("\n").map((paragraph, index) => {
              if (paragraph.startsWith("# ")) {
                return (
                  <h1
                    key={index}
                    className="text-3xl font-bold text-gray-900 mt-12 mb-6"
                  >
                    {paragraph.slice(2)}
                  </h1>
                );
              } else if (paragraph.startsWith("## ")) {
                return (
                  <h2
                    key={index}
                    className="text-2xl font-bold text-gray-900 mt-10 mb-4"
                  >
                    {paragraph.slice(3)}
                  </h2>
                );
              } else if (paragraph.startsWith("### ")) {
                return (
                  <h3
                    key={index}
                    className="text-xl font-semibold text-gray-900 mt-8 mb-3"
                  >
                    {paragraph.slice(4)}
                  </h3>
                );
              } else if (
                paragraph.startsWith("**") &&
                paragraph.endsWith("**")
              ) {
                return (
                  <p key={index} className="font-semibold text-gray-900 mb-4">
                    {paragraph.slice(2, -2)}
                  </p>
                );
              } else if (
                paragraph.startsWith("*") &&
                paragraph.endsWith("*") &&
                !paragraph.includes("**")
              ) {
                return (
                  <p
                    key={index}
                    className="italic text-gray-700 bg-teal-50 p-4 rounded-lg mb-6 border-l-4 border-teal-600"
                  >
                    {paragraph.slice(1, -1)}
                  </p>
                );
              } else if (paragraph.startsWith("- ")) {
                return (
                  <li key={index} className="text-gray-700 mb-2">
                    {paragraph.slice(2)}
                  </li>
                );
              } else if (paragraph.trim() === "") {
                return null;
              } else {
                return (
                  <p key={index} className="text-gray-700 mb-6 leading-relaxed">
                    {paragraph}
                  </p>
                );
              }
            })}
          </div>

          {/* Tags */}
          <div className="mt-12 pt-8 border-t">
            <div className="flex items-center space-x-2 mb-6">
              <Tag className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Tags:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="hover:bg-teal-50 cursor-pointer"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Author Bio */}
          <div className="mt-12 pt-8 border-t">
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="flex items-start space-x-4">
                <div className="h-16 w-16 bg-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    About {article.author}
                  </h3>
                  <p className="text-gray-600">{article.authorBio}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Related Studies */}
          {article.relatedStudies && article.relatedStudies.length > 0 && (
            <div className="mt-12 pt-8 border-t">
              <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                Related Research Studies
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {article.relatedStudies.slice(0, 3).map((studyId, index) => (
                  <Link key={index} href={`/study/id/${studyId}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardHeader>
                        <CardTitle className="text-sm">
                          Study #{studyId}
                        </CardTitle>
                        <p className="text-xs text-gray-600">
                          Referenced in this article - click to view full study
                          details
                        </p>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Related Articles */}
        <section className="bg-gray-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              Related Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relatedArticles.map((relatedArticle) => (
                <Link
                  key={relatedArticle.id}
                  href={`/blog/${relatedArticle.id}`}
                >
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <Badge variant="secondary" className="w-fit mb-2">
                        {relatedArticle.category}
                      </Badge>
                      <CardTitle className="text-lg line-clamp-2">
                        {relatedArticle.title}
                      </CardTitle>
                      <p className="text-sm text-gray-500">
                        {relatedArticle.readTime}
                      </p>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
