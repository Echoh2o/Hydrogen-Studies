import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Study } from "@shared/schema";
import {
  HiUser,
  HiBookOpen,
  HiQuote,
  HiDocument,
  HiFilter,
  HiChevronRight,
  HiChevronLeft,
} from "react-icons/hi";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Helmet } from "react-helmet";

const RecentStudiesPage = () => {
  const [limit, setLimit] = useState(10);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "citations">(
    "newest",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const {
    data: studies,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/studies"],
  });

  // Sort studies based on selected order
  const sortedStudies = studies
    ? [...studies].sort((a, b) => {
        if (sortOrder === "newest") return b.year - a.year;
        if (sortOrder === "oldest") return a.year - b.year;
        if (sortOrder === "citations") return b.citations - a.citations;
        return 0;
      })
    : [];

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStudies = sortedStudies.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedStudies.length / itemsPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <Helmet>
        <title>Recent Studies - Hydrogen Research Database</title>
        <meta
          name="description"
          content="Browse the latest research studies on hydrogen gas and its health applications. Discover new findings in hydrogen therapy research."
        />
      </Helmet>

      <section className="bg-primary-gradient text-white py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-center">
            Recent Hydrogen Studies
          </h1>
          <p className="text-lg md:text-xl text-center max-w-3xl mx-auto text-white/90">
            The latest research on hydrogen gas and health
          </p>
        </div>
      </section>

      <section className="py-8 bg-white">
        <div className="container mx-auto px-4">
          {/* Filter and Sort Controls */}
          <div className="bg-neutral-50 p-4 rounded-lg mb-8 flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <HiFilter className="text-neutral-500 mr-2" />
              <span className="text-neutral-800 font-medium mr-3">
                Sort by:
              </span>
              <Select
                value={sortOrder}
                onValueChange={(value) =>
                  setSortOrder(value as "newest" | "oldest" | "citations")
                }
              >
                <SelectTrigger className="w-40 bg-white">
                  <SelectValue placeholder="Sort order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="citations">Most Cited</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-neutral-600 text-sm">
              Showing {sortedStudies.length > 0 ? indexOfFirstItem + 1 : 0} -{" "}
              {Math.min(indexOfLastItem, sortedStudies.length)} of{" "}
              {sortedStudies.length} studies
            </div>
          </div>

          {/* Studies Listing */}
          {isLoading ? (
            <div className="space-y-6">
              {[...Array(5)].map((_, index) => (
                <div
                  key={index}
                  className="bg-white border border-neutral-200 rounded-xl shadow-sm p-6 animate-pulse"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-neutral-200 h-5 w-24 rounded-full"></div>
                    <div className="bg-neutral-200 h-4 w-12 rounded"></div>
                  </div>
                  <div className="h-6 bg-neutral-200 rounded w-full mb-2"></div>
                  <div className="h-6 bg-neutral-200 rounded w-3/4 mb-3"></div>
                  <div className="space-y-1 mb-4">
                    <div className="h-4 bg-neutral-200 rounded w-full"></div>
                    <div className="h-4 bg-neutral-200 rounded w-full"></div>
                    <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="h-4 bg-neutral-200 rounded w-24 mr-4"></div>
                      <div className="h-4 bg-neutral-200 rounded w-24"></div>
                    </div>
                    <div className="h-4 bg-neutral-200 rounded w-16"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">
                Error loading studies. Please try again later.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-6">
                {currentStudies.map((study: Study) => (
                  <div
                    key={study.id}
                    className="bg-white border border-neutral-200 rounded-xl shadow-sm hover:shadow-md transition p-6"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="bg-primary/10 text-primary text-xs font-medium px-3 py-1 rounded-full">
                        {study.category}
                      </span>
                      <span className="text-neutral-500 text-sm">
                        {study.year}
                      </span>
                    </div>
                    <h2 className="text-xl font-semibold mb-3">
                      <Link href={`/study/${study.id}`}>
                        <a className="hover:text-primary">{study.title}</a>
                      </Link>
                    </h2>
                    <p className="text-neutral-600 mb-4">{study.abstract}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-col sm:flex-row sm:items-center mb-3 sm:mb-0">
                        <span className="flex items-center text-neutral-500 text-sm mr-4 mb-2 sm:mb-0">
                          <HiUser className="mr-1" /> {study.authors}
                        </span>
                        <span className="flex items-center text-neutral-500 text-sm">
                          <HiBookOpen className="mr-1" /> {study.journal}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="flex items-center text-neutral-500 text-sm mr-4">
                          <HiQuote className="mr-1" /> {study.citations}{" "}
                          citations
                        </span>
                        <Link href={`/study/${study.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-primary border-primary hover:bg-primary/5"
                          >
                            View Study
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-8">
                  <nav className="flex items-center">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        handlePageChange(Math.max(1, currentPage - 1))
                      }
                      disabled={currentPage === 1}
                      className="mr-2"
                    >
                      <HiChevronLeft />
                    </Button>

                    <div className="flex space-x-1">
                      {[...Array(totalPages)].map((_, index) => (
                        <Button
                          key={index}
                          variant={
                            currentPage === index + 1 ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handlePageChange(index + 1)}
                          className={
                            currentPage === index + 1
                              ? "bg-primary text-white"
                              : ""
                          }
                        >
                          {index + 1}
                        </Button>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        handlePageChange(Math.min(totalPages, currentPage + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="ml-2"
                    >
                      <HiChevronRight />
                    </Button>
                  </nav>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
};

export default RecentStudiesPage;
