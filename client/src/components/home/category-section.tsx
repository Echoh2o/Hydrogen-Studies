import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import CategoryCard from "@/components/studies/category-card";
import { CardSkeleton, EmptyState, ErrorDisplay } from "@/components/ui/loading-states";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { FolderTree } from "lucide-react";
import { Category } from "@/types";

export default function CategorySection() {
  const { data: categories, isLoading, isError, error, refetch } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  return (
    <section className="py-12 bg-neutral-100">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold font-heading text-neutral-900 mb-4">Browse by Category</h2>
          <p className="text-neutral-600 max-w-2xl mx-auto">
            Explore our comprehensive collection of hydrogen research organized by health categories.
          </p>
        </div>
        
        <ErrorBoundary>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              // Skeleton loading state
              Array(3).fill(0).map((_, i) => (
                <CardSkeleton key={i} />
              ))
            ) : isError ? (
              <div className="col-span-3">
                <ErrorDisplay
                  title="Error loading categories"
                  message="We're having trouble loading research categories. Please try again later."
                  onRetry={() => refetch()}
                />
              </div>
            ) : categories && categories.length > 0 ? (
              categories.slice(0, 3).map(category => (
                <CategoryCard key={category.id} category={category} />
              ))
            ) : (
              <div className="col-span-3">
                <EmptyState
                  title="No categories available"
                  description="We couldn't find any research categories in our database."
                  icon={<FolderTree className="w-12 h-12" />}
                />
              </div>
            )}
          </div>
        </ErrorBoundary>
        
        <div className="text-center mt-10">
          <Button 
            variant="outline" 
            className="border-primary text-primary hover:bg-primary hover:text-white"
            asChild
          >
            <Link href="/categories">View All Categories</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
