import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import StudyCard from "@/components/studies/study-card";
import { CardSkeleton, EmptyState, ErrorDisplay } from "@/components/ui/loading-states";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Study } from "@/types";

export default function LatestStudiesSection() {
  const { data: studies, isLoading, isError, error, refetch } = useQuery<Study[]>({
    queryKey: ['/api/studies/latest'],
    queryFn: async () => {
      const response = await fetch('/api/studies/latest');
      if (!response.ok) {
        throw new Error('Failed to fetch latest studies');
      }
      return response.json();
    }
  });

  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold font-heading text-neutral-900 mb-2">Latest Research</h2>
            <p className="text-neutral-600">Recently added studies to our database</p>
          </div>
          <Link href="/studies" className="text-primary font-medium hover:underline hidden md:inline-block">
            View all research →
          </Link>
        </div>
        
        <ErrorBoundary>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              // Skeleton loading state
              Array(3).fill(0).map((_, i) => (
                <CardSkeleton key={i} />
              ))
            ) : isError ? (
              <div className="col-span-3">
                <ErrorDisplay
                  title="Error loading latest studies"
                  message="We're having trouble loading the latest studies. Please try again later."
                  onRetry={() => refetch()}
                />
              </div>
            ) : studies && studies.length > 0 ? (
              studies.map(study => (
                <StudyCard key={study.id} study={study} />
              ))
            ) : (
              <div className="col-span-3">
                <EmptyState
                  title="No studies available"
                  description="We couldn't find any recent studies in our database."
                  icon={<FileSearch className="w-12 h-12" />}
                  action={
                    <Link href="/studies">
                      <Button>Browse all studies</Button>
                    </Link>
                  }
                />
              </div>
            )}
          </div>
        </ErrorBoundary>
        
        <div className="text-center mt-8 md:hidden">
          <Link href="/studies" className="text-primary font-medium hover:underline">
            View all research →
          </Link>
        </div>
      </div>
    </section>
  );
}
