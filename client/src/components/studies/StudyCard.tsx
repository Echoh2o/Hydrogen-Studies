import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, ArrowRight } from "lucide-react";

export interface StudyCardProps {
  id: number;
  title: string;
  category: string;
  authors: string;
  publishDate?: string;
  imageUrl?: string;
  relevanceScore?: number;
  reason?: string;
}

export function StudyCard({
  id,
  title,
  category,
  authors,
  publishDate,
  imageUrl,
  relevanceScore,
  reason,
}: StudyCardProps) {
  return (
    <Link href={`/study/${id}`}>
      <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer flex flex-col group overflow-hidden">
        {imageUrl && (
            <div className="relative h-40 overflow-hidden">
                <img 
                    src={imageUrl} 
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                    {reason && (
                        <Badge variant="secondary" className="bg-white/90 text-xs backdrop-blur-sm shadow-sm">
                            {reason}
                        </Badge>
                    )}
                    {relevanceScore && relevanceScore > 0 && (
                        <Badge className="bg-teal-600/90 text-white text-xs backdrop-blur-sm shadow-sm">
                            {Math.round(relevanceScore * 100)}% Match
                        </Badge>
                    )}
                </div>
            </div>
        )}
        <CardHeader className="p-4 pb-2">
          <div className="flex justify-between items-start mb-2">
            <Badge variant="outline" className="text-xs">
              {category}
            </Badge>
            {/* Show score if high enough, maybe? For now hidden to keep it clean */}
          </div>
          <CardTitle className="text-lg leading-tight group-hover:text-teal-600 transition-colors line-clamp-2">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-grow flex flex-col justify-between">
          <div className="space-y-2 mt-2">
            <div className="flex items-center text-xs text-neutral-500">
              <User className="w-3 h-3 mr-1" />
              <span className="truncate max-w-[150px]">{authors}</span>
            </div>
            {publishDate && (
              <div className="flex items-center text-xs text-neutral-500">
                <Calendar className="w-3 h-3 mr-1" />
                <span>{new Date(publishDate).getFullYear()}</span>
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-neutral-100 flex justify-between items-center">
            <span className="text-xs font-medium text-teal-600 group-hover:underline">
                Read Study
            </span>
            <ArrowRight className="w-4 h-4 text-teal-600 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
