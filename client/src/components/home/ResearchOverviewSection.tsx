import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const ResearchOverviewSection = () => {
  return (
    <section className="py-12 bg-neutral-100">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-12 items-center">
          <div className="lg:w-1/2 order-2 lg:order-1">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Hydrogen Research Overview
            </h2>

            <div className="space-y-5 mb-6">
              <p className="text-neutral-700">
                Hydrogen gas (H<sub>2</sub>) has emerged as a potential
                therapeutic agent with anti-inflammatory, antioxidant, and
                anti-apoptotic effects. Research indicates it may have
                applications across numerous health conditions.
              </p>
              <p className="text-neutral-700">
                The scientific community has documented hydrogen's potential
                benefits in neurological disorders, cardiovascular diseases,
                metabolic conditions, and autoimmune disorders. Our database
                comprehensively catalogues this expanding field of research.
              </p>
              <p className="text-neutral-700">
                HydrogenStudies.com aims to be the definitive resource for
                researchers, healthcare professionals, and individuals
                interested in the therapeutic applications of molecular
                hydrogen.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/about">
                <Button className="bg-primary hover:bg-primary-dark text-white">
                  Learn More
                </Button>
              </Link>
              <Link href="/research-analytics">
                <Button
                  variant="outline"
                  className="bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-800"
                >
                  Research Timeline
                </Button>
              </Link>
            </div>
          </div>

          <div className="lg:w-1/2 order-1 lg:order-2">
            <img
              src="https://images.unsplash.com/photo-1581093588401-fbb62a02f120?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1200&h=800"
              alt="Scientific research in laboratory"
              loading="lazy"
              decoding="async"
              className="rounded-xl shadow-lg w-full h-auto"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
          <div className="bg-white p-5 rounded-xl shadow-sm">
            <div className="text-primary text-2xl font-bold mb-1">500+</div>
            <div className="text-neutral-800 font-medium">Indexed Studies</div>
            <p className="text-neutral-600 text-sm mt-2">
              Comprehensive collection of hydrogen research papers
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm">
            <div className="text-primary text-2xl font-bold mb-1">12</div>
            <div className="text-neutral-800 font-medium">
              Research Categories
            </div>
            <p className="text-neutral-600 text-sm mt-2">
              Organized by medical specialty and focus area
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm">
            <div className="text-primary text-2xl font-bold mb-1">75%</div>
            <div className="text-neutral-800 font-medium">
              Full Text Available
            </div>
            <p className="text-neutral-600 text-sm mt-2">
              Direct access to complete research papers
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm">
            <div className="text-primary text-2xl font-bold mb-1">Monthly</div>
            <div className="text-neutral-800 font-medium">Database Updates</div>
            <p className="text-neutral-600 text-sm mt-2">
              Regular additions of newly published research
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ResearchOverviewSection;
