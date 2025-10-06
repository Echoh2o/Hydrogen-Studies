import { Link } from "wouter";
import { Study } from "@/types";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { User, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

interface StudyCardProps {
  study: Study;
}

export default function StudyCard({ study }: StudyCardProps) {
  // Handle null/undefined category gracefully
  const category = study.category || "General";
  const categoryColor = getCategoryColor(category);

  function getCategoryColor(category: string) {
    const categoryLower = category.toLowerCase();
    switch (categoryLower) {
      case "cardiovascular":
      case "cardiovascular health":
        return "bg-secondary/10 text-secondary";
      case "neurology":
      case "neurodegenerative":
      case "neurodegenerative diseases":
        return "bg-accent/10 text-accent";
      case "metabolism":
      case "metabolism & diabetes":
        return "bg-primary/10 text-primary";
      case "inflammation":
        return "bg-orange-500/10 text-orange-500";
      case "cancer":
        return "bg-rose-500/10 text-rose-500";
      case "aging":
        return "bg-purple-500/10 text-purple-500";
      case "sports performance":
        return "bg-blue-500/10 text-blue-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  }

  // Safe date formatting
  const displayDate = study.publishDate
    ? formatDate(study.publishDate)
    : study.journalPublishDate
      ? formatDate(study.journalPublishDate)
      : "No date";

  return (
    <motion.div
      className="bg-neutral-50 rounded-xl p-6 shadow-sm h-full"
      whileHover={{
        scale: 1.02,
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
        y: -5,
      }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start justify-between mb-4">
        <motion.div whileHover={{ scale: 1.1 }} transition={{ duration: 0.2 }}>
          <Badge variant="outline" className={`${categoryColor} border-none`}>
            {category}
          </Badge>
        </motion.div>
        <span className="text-neutral-500 text-sm">{displayDate}</span>
      </div>

      <h3 className="font-heading font-bold text-lg mb-3 text-neutral-800 line-clamp-2">
        <Link
          href={`/study/${study.id}`}
          className="hover:text-primary transition-colors duration-200"
        >
          {study.title}
        </Link>
      </h3>

      <p className="text-neutral-600 text-sm mb-4 line-clamp-3">
        {study.abstract}
      </p>

      <div className="flex items-center text-sm text-neutral-500 mb-4">
        <motion.span
          className="flex items-center mr-4"
          whileHover={{ x: 2 }}
          transition={{ duration: 0.2 }}
        >
          <User className="h-4 w-4 mr-1" />
          {study.authors}
        </motion.span>
        <motion.span
          className="flex items-center"
          whileHover={{ x: 2 }}
          transition={{ duration: 0.2 }}
        >
          <BookOpen className="h-4 w-4 mr-1" />
          {study.journal}
        </motion.span>
      </div>

      <motion.div whileHover={{ x: 5 }} transition={{ duration: 0.2 }}>
        <Link
          href={`/study/${study.id}`}
          className="btn-tertiary btn-sm inline-flex items-center"
        >
          Read full study →
        </Link>
      </motion.div>
    </motion.div>
  );
}
