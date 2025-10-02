import { Link } from "wouter";
import { Category } from "@/types";

interface CategoryCardProps {
  category: Category;
}

export default function CategoryCard({ category }: CategoryCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md">
      <div className="h-40 overflow-hidden">
        <div className="w-full h-full bg-gradient-to-r from-neutral-200 to-neutral-300 relative">
          {category.icon && (
            <svg
              className="absolute inset-0 m-auto h-20 w-20 text-primary opacity-20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d={category.icon} fill="currentColor" />
            </svg>
          )}
        </div>
      </div>
      <div className="p-6">
        <h3 className="font-heading font-bold text-xl mb-2 text-neutral-800">
          {category.name}
        </h3>
        <p className="text-neutral-600 mb-4">{category.description}</p>
        <div className="flex justify-between items-center">
          <span className="text-sm text-neutral-500">
            {category.studyCount} studies
          </span>
          <Link
            href={`/search?q=${encodeURIComponent(category.name)}`}
            className="text-primary font-medium text-sm hover:underline"
          >
            Search studies →
          </Link>
        </div>
      </div>
    </div>
  );
}
