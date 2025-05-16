import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import StudyCard from "@/components/studies/study-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Study } from "@/types";

export default function LatestStudiesSection() {
  const { data: studies, isLoading } = useQuery<Study[]>({
    queryKey: ['/api/studies/latest'],
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            // Skeleton loading state
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-neutral-50 rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-6 w-full mb-2" />
                <Skeleton className="h-6 w-3/4 mb-3" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-3/4 mb-4" />
                <div className="flex items-center space-x-4 mb-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-4 w-28" />
              </div>
            ))
          ) : studies && studies.length > 0 ? (
            studies.map(study => (
              <StudyCard key={study.id} study={study} />
            ))
          ) : (
            <div className="col-span-3 text-center py-8">
              <p>No studies found.</p>
            </div>
          )}
        </div>
        
        <div className="text-center mt-8 md:hidden">
          <Link href="/studies" className="text-primary font-medium hover:underline">
            View all research →
          </Link>
        </div>
      </div>
    </section>
  );
}
