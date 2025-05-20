import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { type Category } from "@/types";
import { HiArrowRight } from "react-icons/hi";
import { 
  HiBrain, 
  HiHeart, 
  HiShieldExclamation, 
  HiDatabase, 
  HiClock, 
  HiBeaker
} from "react-icons/hi";

const CategoriesSection = () => {
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

  // If loading, show a loading state with placeholder cards
  if (isLoading) {
    return (
      <section className="py-12 bg-neutral-100">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Research Categories</h2>
          <p className="text-neutral-600 text-center mb-8">Browse hydrogen research by field of study</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse">
                <div className="p-5">
                  <div className="bg-neutral-200 rounded-full w-12 h-12 mb-4"></div>
                  <div className="h-6 bg-neutral-200 rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-neutral-200 rounded w-full mb-1"></div>
                  <div className="h-4 bg-neutral-200 rounded w-full mb-1"></div>
                  <div className="h-4 bg-neutral-200 rounded w-2/3 mb-3"></div>
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
      <section className="py-12 bg-neutral-100">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Research Categories</h2>
          <p className="text-red-500">Error loading categories. Please try again later.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 bg-neutral-100">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Research Categories</h2>
        <p className="text-neutral-600 text-center mb-8">Browse hydrogen research by field of study</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories?.map((category: Category) => (
            <Link key={category.id} href={`/category/${category.name.toLowerCase()}`}>
              <a className="bg-white rounded-xl shadow-sm hover:shadow-md transition overflow-hidden group">
                <div className="p-5">
                  <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mb-4 text-primary group-hover:bg-primary group-hover:text-white transition">
                    {getCategoryIcon(category.icon)}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{category.name}</h3>
                  <p className="text-neutral-600 mb-3">{category.description}</p>
                  <div className="text-primary font-medium flex items-center group-hover:translate-x-1 transition-transform">
                    View Studies <HiArrowRight className="ml-2" />
                  </div>
                </div>
              </a>
            </Link>
          ))}
        </div>
        
        <div className="text-center mt-8">
          <Link href="/categories">
            <Button variant="outline" className="bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-800">
              View All Categories <HiArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CategoriesSection;
