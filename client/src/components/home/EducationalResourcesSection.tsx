import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Resource } from "@shared/schema";
import { HiArrowRight } from "react-icons/hi";

const EducationalResourcesSection = () => {
  const {
    data: resources,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/resources"],
  });

  // If loading, show a loading state with placeholder cards
  if (isLoading) {
    return (
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
            Educational Resources
          </h2>
          <p className="text-neutral-600 text-center mb-8">
            Learn about hydrogen research and its applications
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="bg-neutral-100 rounded-xl overflow-hidden shadow-sm animate-pulse"
              >
                <div className="h-48 bg-neutral-200"></div>
                <div className="p-5">
                  <div className="h-6 bg-neutral-200 rounded w-3/4 mb-2"></div>
                  <div className="space-y-1 mb-3">
                    <div className="h-4 bg-neutral-200 rounded w-full"></div>
                    <div className="h-4 bg-neutral-200 rounded w-full"></div>
                    <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
                  </div>
                  <div className="h-5 bg-neutral-200 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // If error, show error state
  if (error) {
    return (
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Educational Resources
          </h2>
          <p className="text-red-500">
            Error loading educational resources. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
          Educational Resources
        </h2>
        <p className="text-neutral-600 text-center mb-8">
          Learn about hydrogen research and its applications
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {resources?.slice(0, 3).map((resource: Resource) => (
            <Link key={resource.id} href={`/resources/${resource.slug}`}>
              <a className="group">
                <div className="bg-neutral-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
                  <img
                    src={resource.imageUrl}
                    alt={resource.title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-5">
                    <h3 className="text-xl font-semibold mb-2">
                      {resource.title}
                    </h3>
                    <p className="text-neutral-600 mb-3">
                      {resource.description}
                    </p>
                    <div className="text-primary font-medium flex items-center group-hover:translate-x-1 transition-transform">
                      Read Guide <HiArrowRight className="ml-2" />
                    </div>
                  </div>
                </div>
              </a>
            </Link>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link href="/resources">
            <Button
              variant="secondary"
              className="bg-primary/10 hover:bg-primary/20 text-primary"
            >
              View All Resources <HiArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default EducationalResourcesSection;
