import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

interface Props {
  categoryType: string; // "condition" | "body_system" | "life_stage"
  category: string; // e.g. "Heart Disease & Hypertension"
}

interface AnchorData {
  title: string;
  summary: string;
  content: string;
  studyCount: number;
}

export default function AnchorContent({ categoryType, category }: Props) {
  const { data } = useQuery<{ success: boolean; data: AnchorData | null }>({
    queryKey: ["/api/consumer-categories/anchor-content", categoryType, category],
    queryFn: async () => {
      const res = await fetch(
        `/api/consumer-categories/anchor-content/${categoryType}/${encodeURIComponent(category)}`
      );
      if (!res.ok) return { success: false, data: null };
      return res.json();
    },
    enabled: !!category,
    staleTime: 30 * 60 * 1000, // Cache for 30 minutes
  });

  const anchor = data?.data;
  if (!anchor) return null;

  return (
    <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg p-6 mb-8">
      <h2 className="text-xl font-semibold mb-2">{anchor.title}</h2>
      <p className="text-sm text-muted-foreground mb-3">{anchor.summary}</p>
      <p className="text-sm leading-relaxed text-gray-700">{anchor.content}</p>
      {anchor.studyCount > 0 && (
        <Badge variant="secondary" className="mt-4">
          {anchor.studyCount} studies in this category
        </Badge>
      )}
    </div>
  );
}
