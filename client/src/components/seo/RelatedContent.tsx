import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, FileText, ArrowRight } from "lucide-react";

interface RelatedLink {
  type: string;
  id: number;
  anchorText: string;
  linkType: string;
  relevanceScore: number;
  url: string;
}

interface RelatedContentProps {
  contentType: "study" | "blog";
  contentId: number;
  className?: string;
}

/**
 * Displays related content links from the internal linking engine.
 * Shows related studies and blog posts for cross-linking SEO.
 */
export default function RelatedContent({ contentType, contentId, className }: RelatedContentProps) {
  const { data: links, isLoading } = useQuery<RelatedLink[]>({
    queryKey: [`/api/internal-links/${contentType}/${contentId}`],
    staleTime: 10 * 60 * 1000,
    enabled: !!contentId,
  });

  if (isLoading || !links || links.length === 0) return null;

  const studyLinks = links.filter((l) => l.type === "study");
  const blogLinks = links.filter((l) => l.type === "blog");

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <ArrowRight className="h-5 w-5 text-teal-600" />
          Related Content
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {studyLinks.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              Related Studies
            </h4>
            <ul className="space-y-2">
              {studyLinks.slice(0, 5).map((link) => (
                <li key={`study-${link.id}`}>
                  <Link
                    href={link.url}
                    className="text-sm text-teal-600 hover:text-teal-800 hover:underline line-clamp-2"
                  >
                    {link.anchorText}
                  </Link>
                  {link.linkType === "citation" && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Cited
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {blogLinks.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              Related Articles
            </h4>
            <ul className="space-y-2">
              {blogLinks.slice(0, 5).map((link) => (
                <li key={`blog-${link.id}`}>
                  <Link
                    href={link.url}
                    className="text-sm text-teal-600 hover:text-teal-800 hover:underline line-clamp-2"
                  >
                    {link.anchorText}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
