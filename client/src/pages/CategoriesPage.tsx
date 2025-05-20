import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { type Category } from "@/types";
import { 
  HiBrain, 
  HiHeart, 
  HiShieldExclamation, 
  HiDatabase, 
  HiClock, 
  HiBeaker,
  HiArrowRight
} from "react-icons/hi";
import { Helmet } from "react-helmet";

const CategoriesPage = () => {
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ["/api/categories"],
  });

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case "brain":
        return <HiBrain className="text-xl" />;
      case "heartbeat":
        return <HiHeart className="text-xl" />;
      case "shield-virus":
        return <HiShieldExclamation className="text-xl" />;
      case "dna":
        return <HiDatabase className="text-xl" />;
      case "hourglass-half":
        return <HiClock className="text-xl" />;
      case "flask":
        return <HiBeaker className="text-xl" />;
      default:
        return <HiBeaker className="text-xl" />;
    }
  };

  return (
    <>
      <Helmet>
        <title>Research Categories - Hydrogen Studies Database</title>
        <meta name="description" content="Browse hydrogen research by category. Explore studies on neurology, cardiology, immunology, metabolism, longevity and more." />
      </Helmet>
      
      <section className="bg-primary-gradient text-white py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-center">Research Categories</h1>
          <p className="text-lg md:text-xl text-center max-w-3xl mx-auto text-white/90">
            Browse hydrogen research by field of study
          </p>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(9)].map((_, index) => (
                <div key={index} className="bg-neutral-100 rounded-xl p-6 shadow-sm animate-pulse">
                  <div className="bg-neutral-200 rounded-full w-12 h-12 mb-4"></div>
                  <div className="h-6 bg-neutral-200 rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-neutral-200 rounded w-full mb-1"></div>
                  <div className="h-4 bg-neutral-200 rounded w-full mb-1"></div>
                  <div className="h-4 bg-neutral-200 rounded w-2/3 mb-3"></div>
                  <div className="h-4 bg-neutral-200 rounded w-24 mt-4"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">Error loading categories. Please try again later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {categories?.map((category: Category) => (
                <Link key={category.id} href={`/category/${category.name.toLowerCase()}`}>
                  <a className="bg-white border border-neutral-200 rounded-xl shadow-sm hover:shadow-md transition p-6 group">
                    <div className="bg-primary/10 rounded-full w-14 h-14 flex items-center justify-center mb-4 text-primary group-hover:bg-primary group-hover:text-white transition">
                      {getCategoryIcon(category.icon)}
                    </div>
                    <h2 className="text-xl font-semibold mb-3">{category.name}</h2>
                    <p className="text-neutral-600 mb-4">{category.description}</p>
                    <div className="text-primary font-medium flex items-center group-hover:translate-x-1 transition-transform">
                      View Studies <HiArrowRight className="ml-2" />
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default CategoriesPage;
