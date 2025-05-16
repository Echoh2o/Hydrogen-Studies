import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import CategoryCard from "@/components/studies/category-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Category } from "@/types";

export default function CategorySection() {
  const { data: categories, isLoading } = useQuery<Category[]>({
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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            // Skeleton loading state
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <Skeleton className="h-40 w-full" />
                <div className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-3/4 mb-4" />
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </div>
            ))
          ) : categories && categories.length > 0 ? (
            categories.slice(0, 3).map(category => (
              <CategoryCard key={category.id} category={category} />
            ))
          ) : (
            <div className="col-span-3 text-center py-8">
              <p>No categories found.</p>
            </div>
          )}
        </div>
        
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
