import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import StudyCard from "@/components/studies/study-card";
import { ArrowLeft } from "lucide-react";
import { Category, Study } from "@/types";

export default function CategoryDetails() {
  const { id } = useParams();

  const { data: category, isLoading: categoryLoading } = useQuery<Category>({
    queryKey: [`/api/categories/${id}`],
  });

  const { data: studies, isLoading: studiesLoading } = useQuery<Study[]>({
    queryKey: [`/api/studies?category=${id}`],
  });

  const isLoading = categoryLoading || studiesLoading;

  if (isLoading) {
    return (
      <div className="bg-neutral-100 py-8 min-h-screen">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-10 w-1/2 mb-2" />
          <Skeleton className="h-5 w-3/4 mb-6" />
          <Separator className="my-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array(4)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
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
              ))}
          </div>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="bg-neutral-100 py-8 min-h-screen">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto bg-white rounded-xl p-8 shadow-sm">
            <h1 className="text-2xl font-bold mb-4">Category Not Found</h1>
            <p className="mb-6">
              The category you're looking for doesn't exist or might have been
              removed.
            </p>
            <Button asChild>
              <Link href="/categories">Back to Categories</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{category.name} Research | Hydrogen Studies</title>
        <meta name="description" content={category.description} />
        <meta
          property="og:title"
          content={`${category.name} Research | Hydrogen Studies`}
        />
        <meta property="og:description" content={category.description} />
      </Helmet>

      <div className="bg-neutral-100 py-8">
        <div className="container mx-auto px-4">
          <Button
            variant="ghost"
            className="mb-4 pl-0 hover:bg-transparent hover:text-primary"
            asChild
          >
            <Link href="/categories">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Categories
            </Link>
          </Button>

          <h1 className="text-3xl font-bold mb-2">{category.name}</h1>
          <p className="text-neutral-600 mb-6 max-w-3xl">
            {category.description}
          </p>

          <Separator className="my-6" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {studies && studies.length > 0 ? (
              studies.map((study) => <StudyCard key={study.id} study={study} />)
            ) : (
              <div className="col-span-2 bg-white rounded-xl p-8 shadow-sm text-center">
                <h3 className="text-lg font-bold mb-2">No studies found</h3>
                <p className="text-neutral-600 mb-4">
                  We couldn't find any studies in this category. Check back
                  later as our database is regularly updated.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
