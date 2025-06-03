import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Helmet } from "react-helmet";
import { HiUser, HiBookOpen, HiDocument, HiFilter, HiChevronRight, HiChevronLeft } from "react-icons/hi";

// Study type definition 
interface Study {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  category: string;
  year?: number;
  citations?: number;
  imageUrl?: string;
  slug?: string;
}

// Category type definition
interface Category {
  id: number;
  name: string;
  description: string;
  count: number;
}

const CategoryPage = () => {
  const { name } = useParams<{ name: string }>();
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'citations'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Get category details
  const { data: category, isLoading: categoryLoading, error: categoryError } = useQuery<Category>({
    queryKey: [`/api/categories/${name}`],
  });

  // Get studies by category
  const { data: studies, isLoading: studiesLoading, error: studiesError } = useQuery<Study[]>({
    queryKey: [`/api/categories/${name}/studies`],
  });

  const isLoading = categoryLoading || studiesLoading;
  const error = categoryError || studiesError;

  // Sort studies based on selected order
  const sortedStudies = studies ? [...studies].sort((a, b) => {
    if (sortOrder === 'newest') return (b.year || 0) - (a.year || 0);
    if (sortOrder === 'oldest') return (a.year || 0) - (b.year || 0);
    if (sortOrder === 'citations') return (b.citations || 0) - (a.citations || 0);
    return 0;
  }) : [];

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStudies = sortedStudies.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedStudies.length / itemsPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <Helmet>
        <title>{category?.name || name} Research - Hydrogen Studies Database</title>
        <meta name="description" content={`Browse hydrogen research studies in ${category?.name || name}. Explore the latest findings and applications in this field.`} />
        <meta name="keywords" content={`hydrogen therapy, molecular hydrogen, ${name?.toLowerCase()}, hydrogen water, h2 therapy, hydrogen research`} />
        <link rel="canonical" href={`https://hydrogenstudies.com/category/${name?.toLowerCase().replace(/\s+/g, '-')}`} />
        
        {/* Open Graph Tags */}
        <meta property="og:title" content={`${category?.name || name} Hydrogen Therapy Research`} />
        <meta property="og:description" content={`Access a comprehensive collection of scientific studies on hydrogen therapy for ${category?.name || name}. Evidence-based research on mechanisms and benefits.`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://hydrogenstudies.com/category/${name?.toLowerCase().replace(/\s+/g, '-')}`} />
        <meta property="og:image" content={`https://hydrogenstudies.com/og-images/category-${name?.toLowerCase().replace(/\s+/g, '-')}.jpg`} />
        
        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${category?.name || name} Hydrogen Research`} />
        <meta name="twitter:description" content={`Discover peer-reviewed studies on hydrogen therapy for ${category?.name || name}. Scientific evidence and clinical applications.`} />
        <meta name="twitter:image" content={`https://hydrogenstudies.com/og-images/category-${name?.toLowerCase().replace(/\s+/g, '-')}.jpg`} />
      </Helmet>
      
      <section className="bg-primary-gradient text-white py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center mb-4">
            <Link href="/categories">
              <span className="text-white/80 hover:text-white text-sm cursor-pointer">Categories</span>
            </Link>
            <span className="mx-2 text-white/60">/</span>
            <span className="text-white text-sm font-medium">{category?.name || name}</span>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-center">
            {category?.name || name} Studies
          </h1>
          {category && (
            <p className="text-lg md:text-xl text-center max-w-3xl mx-auto text-white/90">
              {category.description}
            </p>
          )}
        </div>
      </section>
      
      <section className="py-12 bg-neutral-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
            <h2 className="text-2xl font-bold mb-4 md:mb-0">
              {isLoading ? (
                <span className="animate-pulse bg-neutral-200 h-8 w-48 rounded inline-block"></span>
              ) : (
                `${sortedStudies.length} ${category?.name || name} Studies`
              )}
            </h2>
            
            <div className="flex items-center">
              <HiFilter className="mr-2 text-neutral-500" />
              <span className="mr-3 text-neutral-600 text-sm">Sort by:</span>
              <Select
                value={sortOrder}
                onValueChange={(value) => setSortOrder(value as any)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="citations">Most Cited</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {isLoading ? (
            // Loading state
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow-sm animate-pulse">
                  <div className="h-4 bg-neutral-200 rounded w-1/4 mb-3"></div>
                  <div className="h-6 bg-neutral-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-neutral-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-neutral-200 rounded w-5/6"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            // Error state
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
              <p>Unable to load studies. Please try again later.</p>
            </div>
          ) : sortedStudies.length === 0 ? (
            // Empty state
            <div className="bg-white p-8 rounded-lg shadow-sm text-center">
              <HiDocument className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No Studies Found</h3>
              <p className="text-neutral-500 mb-6">We couldn't find any studies in this category.</p>
              <Link href="/categories">
                <Button>Browse Other Categories</Button>
              </Link>
            </div>
          ) : (
            // Studies list
            <div className="space-y-6">
              {currentStudies.map((study) => (
                <Link key={study.id} href={study.slug ? `/study/${study.slug}` : `/study/id/${study.id}`}>
                  <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-neutral-100">
                    <div className="flex items-start mb-3">
                      <div className="bg-primary/10 text-primary text-xs px-2 py-1 rounded font-medium">
                        {study.category}
                      </div>
                      {study.year && (
                        <div className="ml-3 text-neutral-500 text-sm">
                          {study.year}
                        </div>
                      )}
                    </div>
                    
                    <h3 className="text-xl font-bold mb-3 leading-tight hover:text-primary transition-colors">
                      {study.title}
                    </h3>
                    
                    <p className="text-neutral-600 mb-4 line-clamp-2">
                      {study.abstract}
                    </p>
                    
                    <div className="flex flex-wrap items-center text-sm text-neutral-500">
                      <span className="flex items-center mr-6 mb-2">
                        <HiUser className="mr-1" />
                        {study.authors}
                      </span>
                      <span className="flex items-center mr-6 mb-2">
                        <HiBookOpen className="mr-1" />
                        {study.journal}
                      </span>
                      {study.citations !== undefined && (
                        <span className="flex items-center mb-2">
                          <HiDocument className="mr-1" />
                          {study.citations} citations
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-10">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <HiChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous</span>
                </Button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </Button>
                ))}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <HiChevronRight className="h-4 w-4" />
                  <span className="sr-only">Next</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default CategoryPage;