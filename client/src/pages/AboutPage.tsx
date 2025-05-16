import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import NewsletterSection from "@/components/home/NewsletterSection";
import { Helmet } from "react-helmet";

const AboutPage = () => {
  return (
    <>
      <Helmet>
        <title>About - Hydrogen Studies Research Database</title>
        <meta name="description" content="Learn about the Hydrogen Studies database, our mission, and how we're aggregating research on hydrogen gas and its health applications." />
      </Helmet>
      
      <section className="bg-primary-gradient text-white py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-center">About HydrogenStudies</h1>
          <p className="text-lg md:text-xl text-center max-w-3xl mx-auto text-white/90">
            The definitive resource for hydrogen gas research and its health applications
          </p>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Our Mission</h2>
            
            <div className="prose prose-lg max-w-none">
              <p>
                HydrogenStudies.com was created to address the growing need for a centralized, accessible resource dedicated to the scientific research on molecular hydrogen and its potential health applications.
              </p>
              
              <p>
                As research on hydrogen gas continues to expand across multiple medical disciplines, it has become increasingly challenging for researchers, healthcare professionals, and interested individuals to stay informed of the latest developments. Our mission is to aggregate, organize, and present this research in a user-friendly format that makes it accessible to both scientific professionals and the general public.
              </p>
              
              <h3 className="text-xl font-bold mt-8 mb-4">What We Do</h3>
              
              <p>
                We comprehensively catalog scientific studies on molecular hydrogen across various research areas, including but not limited to:
              </p>
              
              <ul>
                <li>Neurological applications</li>
                <li>Cardiovascular health</li>
                <li>Metabolic disorders</li>
                <li>Inflammatory conditions</li>
                <li>Oxidative stress-related diseases</li>
                <li>Anti-aging research</li>
                <li>Athletic performance and recovery</li>
              </ul>
              
              <p>
                Our database is regularly updated to include the latest published research, ensuring that users have access to the most current information available in this rapidly evolving field.
              </p>
              
              <h3 className="text-xl font-bold mt-8 mb-4">Why Hydrogen Research Matters</h3>
              
              <p>
                Molecular hydrogen (H<sub>2</sub>) has emerged as a unique therapeutic agent with potential applications across a wide range of health conditions. Its antioxidant, anti-inflammatory, and cell-signaling properties make it a promising subject for medical research.
              </p>
              
              <p>
                As a selective antioxidant that targets the most cytotoxic free radicals, hydrogen offers potential benefits without disrupting the normal cellular functions of beneficial reactive oxygen species. This selective action, combined with hydrogen's ability to easily penetrate cell membranes and cross the blood-brain barrier, has drawn significant scientific interest.
              </p>
              
              <h3 className="text-xl font-bold mt-8 mb-4">Our Team</h3>
              
              <p>
                HydrogenStudies.com is maintained by a dedicated team of researchers, medical professionals, and web specialists committed to providing accurate, up-to-date information on hydrogen research. Our advisory board includes experts in molecular biology, medicine, and research methodology who ensure the quality and reliability of our database.
              </p>
            </div>
            
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button className="bg-primary hover:bg-primary-dark text-white">Contact Us</Button>
              </Link>
              <Link href="/categories">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary/5">
                  Explore Research Categories
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
      
      <NewsletterSection />
    </>
  );
};

export default AboutPage;
