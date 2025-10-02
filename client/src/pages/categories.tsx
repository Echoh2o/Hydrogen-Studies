import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Skeleton } from "@/components/ui/skeleton";
import CategoryCard from "@/components/studies/category-card";
import { Category } from "@/types";

export default function Categories() {
  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  return (
    <>
      <Helmet>
        <title>Research Categories | Hydrogen Studies</title>
        <meta
          name="description"
          content="Browse hydrogen research by categories including neurodegenerative diseases, cardiovascular health, metabolism, inflammation, and more."
        />
      </Helmet>

      <div className="bg-neutral-100 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-screen-xl mx-auto">
            <div className="text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-bold font-heading text-neutral-900 mb-4">
                Research Categories
              </h1>
              <p className="text-neutral-600 max-w-2xl mx-auto">
                Explore our comprehensive collection of hydrogen research
                organized by health categories.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                // Skeleton loading state
                Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-xl shadow-sm overflow-hidden"
                    >
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
                categories.map((category) => (
                  <CategoryCard key={category.id} category={category} />
                ))
              ) : (
                <div className="col-span-3 text-center py-8">
                  <p>No categories found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
