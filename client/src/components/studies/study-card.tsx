import { Link } from "wouter";
import { Study } from "@/types";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { User, BookOpen } from "lucide-react";

interface StudyCardProps {
  study: Study;
}

export default function StudyCard({ study }: StudyCardProps) {
  const categoryColor = getCategoryColor(study.category);

  function getCategoryColor(category: string) {
    switch (category.toLowerCase()) {
      case 'cardiovascular':
        return 'bg-secondary/10 text-secondary';
      case 'neurology':
      case 'neurodegenerative':
        return 'bg-accent/10 text-accent';
      case 'metabolism':
        return 'bg-primary/10 text-primary';
      case 'inflammation':
        return 'bg-orange-500/10 text-orange-500';
      case 'cancer':
        return 'bg-rose-500/10 text-rose-500';
      case 'aging':
        return 'bg-purple-500/10 text-purple-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  }

  return (
    <div className="bg-neutral-50 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <Badge variant="outline" className={`${categoryColor} border-none`}>
          {study.category}
        </Badge>
        <span className="text-neutral-500 text-sm">{formatDate(study.publishDate)}</span>
      </div>
      
      <h3 className="font-heading font-bold text-lg mb-3 text-neutral-800 line-clamp-2">
        <Link href={`/study/${study.id}`} className="hover:text-primary">
          {study.title}
        </Link>
      </h3>
      
      <p className="text-neutral-600 text-sm mb-4 line-clamp-3">
        {study.abstract}
      </p>
      
      <div className="flex items-center text-sm text-neutral-500 mb-4">
        <span className="flex items-center mr-4">
          <User className="h-4 w-4 mr-1" />
          {study.authors}
        </span>
        <span className="flex items-center">
          <BookOpen className="h-4 w-4 mr-1" />
          {study.journal}
        </span>
      </div>
      
      <Link href={`/study/${study.id}`} className="text-primary text-sm font-medium hover:underline">
        Read full study →
      </Link>
    </div>
  );
}
