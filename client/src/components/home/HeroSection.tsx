import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { HiSearch, HiViewGrid } from "react-icons/hi";

const HeroSection = () => {
  return (
    <section className="bg-gradient-to-r from-primary to-primary-light text-white py-12 md:py-20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 mb-8 md:mb-0">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Discover Hydrogen Research for Health
            </h1>
            <p className="text-lg md:text-xl mb-6 text-white/90">
              The comprehensive database for scientific studies on hydrogen gas
              and its health benefits.
            </p>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
              <Link href="#search-section">
                <Button className="bg-white text-primary hover:bg-neutral-100 font-semibold w-full sm:w-auto">
                  <HiSearch className="mr-2" size={18} /> Find Studies
                </Button>
              </Link>
              <Link href="/categories">
                <Button
                  variant="outline"
                  className="bg-transparent text-white border border-white hover:bg-white/10 w-full sm:w-auto"
                >
                  <HiViewGrid className="mr-2" size={18} /> Browse Categories
                </Button>
              </Link>
            </div>
          </div>
          <div className="md:w-1/2 md:pl-8">
            <img
              src="https://images.unsplash.com/photo-1532094349884-543bc11b234d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&h=800"
              alt="Hydrogen molecule visualization"
              className="w-full h-auto rounded-lg shadow-lg"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
