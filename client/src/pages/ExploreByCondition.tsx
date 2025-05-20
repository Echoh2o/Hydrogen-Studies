import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Heart, ArrowRight, Loader2 } from "lucide-react";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface Condition {
  name: string;
  count: number;
}

const ExploreByCondition = () => {
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Health conditions categories and counts
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const fetchCategories = async () => {
      try {
        // Try to fetch from API
        const response = await fetch('/api/consumer-categories/counts');
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data && data.data.condition) {
            setConditions(data.data.condition.sort((a: Condition, b: Condition) => b.count - a.count));
          } else {
            // If no condition data, use predefined list
            useStandardConditions();
          }
        } else {
          // If API fails, use predefined list
          useStandardConditions();
        }
      } catch (err) {
        console.error("Failed to fetch categories:", err);
        setError("Failed to load health conditions. Using default categories.");
        useStandardConditions();
      } finally {
        setIsLoading(false);
      }
    };

    const useStandardConditions = () => {
      const standardConditions = [
        { name: "Diabetes & Metabolic Health", count: 15 },
        { name: "Heart Disease & Hypertension", count: 18 },
        { name: "Brain & Neurological Disorders", count: 34 },
        { name: "Arthritis & Inflammation", count: 13 },
        { name: "Lung & Respiratory Conditions", count: 19 },
        { name: "Digestive Health", count: 24 },
        { name: "Cancer Supportive Care", count: 10 },
        { name: "Kidney Health", count: 8 },
        { name: "Skin Conditions", count: 17 },
        { name: "Aging", count: 12 },
        { name: "General Wellness", count: 22 }
      ];
      setConditions(standardConditions);
    };

    fetchCategories();
  }, []);

  // Group conditions into top conditions and others
  const topConditions = conditions.slice(0, 6);
  const otherConditions = conditions.slice(6);

  return (
    <div className="container mx-auto px-4 py-8">
      <Helmet>
        <title>Explore by Health Condition | HydrogenStudies.com</title>
        <meta 
          name="description" 
          content="Browse hydrogen therapy research studies by health condition. Find the latest research on how molecular hydrogen may benefit specific health conditions and diseases."
        />
      </Helmet>

      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-primary mb-4 flex items-center justify-center">
          <Heart className="h-8 w-8 mr-3 text-red-500" />
          Explore Hydrogen Research by Health Condition
        </h1>
        <p className="text-neutral-600 max-w-2xl mx-auto">
          Browse our collection of hydrogen therapy research studies organized by health condition. 
          Discover how molecular hydrogen may benefit specific health conditions through its 
          antioxidant, anti-inflammatory, and cell-signaling properties.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-neutral-700">Loading health conditions...</span>
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-red-500">Error loading health conditions. Please try again.</p>
        </div>
      ) : (
        <>
          {/* Highlighted top health conditions */}
          <h2 className="text-2xl font-bold text-neutral-800 mb-6">
            Top Health Conditions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {topConditions.map((condition) => (
              <Card 
                key={condition.name} 
                className="shadow-md hover:shadow-lg transition-shadow duration-200"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl font-bold text-primary">
                    {condition.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-600">
                    Explore {condition.count} {condition.count === 1 ? 'study' : 'studies'} on how hydrogen therapy 
                    may benefit {condition.name.toLowerCase()} conditions.
                  </p>
                </CardContent>
                <CardFooter>
                  <Link href={`/condition/${encodeURIComponent(condition.name)}`}>
                    <Button className="w-full">
                      View Studies
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* All health conditions */}
          <h2 className="text-2xl font-bold text-neutral-800 mb-6">
            All Health Conditions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {conditions.map((condition) => (
              <Link 
                key={condition.name} 
                href={`/condition/${encodeURIComponent(condition.name)}`}
                className="block"
              >
                <div className="bg-white p-4 rounded-lg border border-neutral-200 hover:border-primary hover:bg-primary/5 transition-colors duration-200">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium text-neutral-800">{condition.name}</h3>
                    <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full">
                      {condition.count}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Related information */}
          <div className="mt-16 p-6 bg-neutral-50 rounded-lg border border-neutral-200">
            <h2 className="text-xl font-semibold text-primary mb-4">About Condition-Based Research</h2>
            <p className="text-neutral-600 mb-4">
              Research into hydrogen's effects on various health conditions is a growing field. Molecular hydrogen
              (H₂) has been studied for its potential therapeutic effects across a range of conditions due to its
              antioxidant properties, anti-inflammatory effects, and ability to modulate cell signaling pathways.
            </p>
            <p className="text-neutral-600">
              Our database categorizes studies based on the conditions they address, making it easier for you
              to find relevant research. We're constantly updating our collection as new studies are published.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default ExploreByCondition;