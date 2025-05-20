import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Heart, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategorizationModel } from "../types/consumer-categories";
import { Helmet } from "react-helmet";

const ExploreByCondition = () => {
  // Fetch all consumer categories with their study counts
  const { data: categoriesData, isLoading } = useQuery({
    queryKey: ["/api/consumer-categories/counts"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get condition categories (filtered from all categories)
  const conditionCategories = categoriesData?.condition || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <Helmet>
        <title>Explore Hydrogen Studies by Health Condition | HydrogenStudies.com</title>
        <meta 
          name="description" 
          content="Browse hydrogen research studies categorized by health conditions such as cardiovascular health, diabetes, neurological disorders, and more." 
        />
      </Helmet>

      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-primary mb-4">
          Explore Hydrogen Studies by Health Condition
        </h1>
        <p className="text-neutral-600 max-w-2xl mx-auto">
          Browse research on how hydrogen may impact different health conditions. Click on a condition 
          to see all related studies and their findings.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-neutral-700">Loading categories...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {conditionCategories && conditionCategories.length > 0 ? (
            conditionCategories.map((category) => (
              <Link 
                key={category.name} 
                href={`/condition/${encodeURIComponent(category.name.toLowerCase())}`}
              >
                <Card className="cursor-pointer hover:shadow-md transition-shadow duration-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center text-xl font-semibold text-primary">
                      <Heart className="h-5 w-5 mr-2 text-red-500" />
                      {category.name}
                    </CardTitle>
                    <CardDescription>
                      {category.count} {category.count === 1 ? 'study' : 'studies'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-neutral-600 text-sm">
                      Explore hydrogen research related to {category.name.toLowerCase()}, including 
                      clinical trials, animal studies, and mechanistic research.
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <div className="col-span-3 text-center py-12">
              <p className="text-neutral-500">
                No health condition categories found. Please check back later as we continue to categorize studies.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-16 max-w-2xl mx-auto p-6 bg-neutral-50 rounded-lg border border-neutral-200">
        <h2 className="text-xl font-semibold text-primary mb-4">About Our Health Condition Categories</h2>
        <p className="text-neutral-600 mb-4">
          Our health condition categorization system makes it easier to find relevant hydrogen research 
          for specific health concerns. Each study is carefully categorized based on the conditions it 
          addresses.
        </p>
        <p className="text-neutral-600">
          These categories are regularly updated as new research emerges. If you're interested in a 
          condition not listed here, please use our search feature or contact us with your specific 
          research interests.
        </p>
      </div>
    </div>
  );
};

export default ExploreByCondition;