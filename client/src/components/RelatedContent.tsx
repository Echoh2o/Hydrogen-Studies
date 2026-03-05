import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkIcon } from "lucide-react";

interface SmartLink {
  toType: string;
  toId: number;
  anchorText: string;
  linkType: string;
  relevanceScore: number;
}

interface Props {
  contentType: "study" | "blog";
  contentId: number;
  title?: string;
}

export default function RelatedContent({ contentType, contentId, title = "Related Content" }: Props) {
  const { data } = useQuery<{ links: SmartLink[] }>({
    queryKey: ["/api/internal-links", contentType, contentId],
    queryFn: async () => {
      const res = await fetch(`/api/internal-links/${contentType}/${contentId}`);
      if (!res.ok) return { links: [] };
      return res.json();
    },
    enabled: !!contentId,
    staleTime: 5 * 60 * 1000,
  });

  const links = data?.links;
  if (!links || links.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <LinkIcon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {links.slice(0, 8).map((link, i) => {
          const href = link.toType === "study"
            ? `/studies/${link.toId}`
            : `/blog/${link.toId}`;
          return (
            <Link key={`${link.toType}-${link.toId}-${i}`} href={href}>
              <div className="flex items-start gap-2 p-2 rounded-md hover:bg-muted transition-colors cursor-pointer">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {link.anchorText}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {link.toType === "study" ? "Study" : "Article"}
                </Badge>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
