import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Study } from "@shared/schema";
import { HiArrowRight, HiUser, HiBookOpen, HiQuote, HiDocument } from "react-icons/hi";

const RecentStudiesSection = () => {
  const { data: recentStudies, isLoading, error } = useQuery({
    queryKey: ["/api/recent-studies"],
  });

  // If loading, show a loading state with placeholder cards
  if (isLoading) {
    return (
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Recent Studies</h2>
              <p className="text-neutral-600">The latest research on hydrogen gas and health</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden animate-pulse">
                <div className="border-b border-neutral-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="bg-neutral-200 h-5 w-24 rounded-full"></div>
                    <div className="bg-neutral-200 h-4 w-12 rounded"></div>
                  </div>
                  <div className="h-6 bg-neutral-200 rounded w-full mb-2"></div>
                  <div className="h-6 bg-neutral-200 rounded w-3/4 mb-2"></div>
                  <div className="space-y-1 mb-3">
                    <div className="h-4 bg-neutral-200 rounded w-full"></div>
                    <div className="h-4 bg-neutral-200 rounded w-full"></div>
                    <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
                  </div>
                  <div className="flex items-center">
                    <div className="h-4 bg-neutral-200 rounded w-24 mr-4"></div>
                    <div className="h-4 bg-neutral-200 rounded w-24"></div>
                  </div>
                </div>
                <div className="p-4 bg-neutral-50 flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="h-4 bg-neutral-200 rounded w-20 mr-4"></div>
                    <div className="h-4 bg-neutral-200 rounded w-16"></div>
                  </div>
                  <div className="h-4 bg-neutral-200 rounded-full w-4"></div>
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
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Recent Studies</h2>
          <p className="text-red-500">Error loading recent studies. Please try again later.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Recent Studies</h2>
            <p className="text-neutral-600">The latest research on hydrogen gas and health</p>
          </div>
          <Link href="/recent" className="hidden md:flex items-center text-primary hover:text-primary-dark font-medium">
            View All <HiArrowRight className="ml-2" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recentStudies?.map((study: Study) => (
            <div key={study.id} className="bg-white border border-neutral-200 rounded-xl shadow-sm hover:shadow-md transition overflow-hidden">
              <div className="border-b border-neutral-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-primary/10 text-primary text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {study.category}
                  </span>
                  <span className="text-neutral-500 text-sm">{study.year}</span>
                </div>
                <h3 className="text-lg font-semibold mb-2 line-clamp-2">
                  <Link href={`/study/${study.id}`}>
                    <a className="hover:text-primary">{study.title}</a>
                  </Link>
                </h3>
                <p className="text-neutral-600 text-sm line-clamp-3 mb-3">{study.abstract}</p>
                <div className="flex items-center text-sm text-neutral-500">
                  <span className="mr-4 flex items-center">
                    <HiUser className="mr-1" /> {study.authors}
                  </span>
                  <span className="flex items-center">
                    <HiBookOpen className="mr-1" /> {study.journal}
                  </span>
                </div>
              </div>
              <div className="p-4 bg-neutral-50 flex justify-between items-center">
                <div className="flex items-center">
                  <span className="mr-4 flex items-center text-neutral-500 text-sm">
                    <HiQuote className="mr-1" /> {study.citations} citations
                  </span>
                  <span className="flex items-center text-neutral-500 text-sm">
                    <HiDocument className="mr-1" /> {study.fullTextAvailable ? "Full text" : "Abstract only"}
                  </span>
                </div>
                <Link href={`/study/${study.id}`}>
                  <a className="text-primary hover:text-primary-dark transition">
                    <HiArrowRight />
                  </a>
                </Link>
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-center mt-8 md:hidden">
          <Link href="/recent">
            <a className="inline-flex items-center text-primary hover:text-primary-dark font-medium">
              View All Recent Studies <HiArrowRight className="ml-2" />
            </a>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default RecentStudiesSection;
