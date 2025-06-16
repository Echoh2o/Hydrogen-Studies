import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Helmet } from "react-helmet";
import { HiMail, HiPhone, HiLocationMarker } from "react-icons/hi";

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
            
            <div className="mt-10 flex justify-center">
              <Link href="/categories">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary/5">
                  Explore Research Categories
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Information Section */}
      <section className="py-12 bg-neutral-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">Contact Us</h2>
            <p className="text-neutral-600 mb-8 text-center max-w-2xl mx-auto">
              Have questions or suggestions? We'd love to hear from you. Whether you're a researcher, healthcare professional, or just interested in the science, we're here to help.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center text-primary mx-auto mb-4">
                  <HiMail size={24} />
                </div>
                <h3 className="font-semibold text-lg mb-2">Email</h3>
                <p className="text-neutral-600">info@hydrogenstudies.com</p>
                <p className="text-neutral-600">research@hydrogenstudies.com</p>
              </div>

              <div className="text-center">
                <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center text-primary mx-auto mb-4">
                  <HiPhone size={24} />
                </div>
                <h3 className="font-semibold text-lg mb-2">Phone</h3>
                <p className="text-neutral-600">+1 (888) 123-4567</p>
                <p className="text-neutral-600 text-sm">Mon-Fri, 9:00 AM - 5:00 PM PST</p>
              </div>

              <div className="text-center">
                <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center text-primary mx-auto mb-4">
                  <HiLocationMarker size={24} />
                </div>
                <h3 className="font-semibold text-lg mb-2">Address</h3>
                <p className="text-neutral-600">
                  123 Research Avenue<br />
                  Suite 450<br />
                  San Francisco, CA 94103<br />
                  United States
                </p>
              </div>
            </div>

            {/* FAQ Section */}
            <div className="mt-12">
              <h3 className="text-xl font-bold text-center mb-8">Frequently Asked Questions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm">
                  <h4 className="font-semibold text-lg mb-3">How can I submit research for inclusion?</h4>
                  <p className="text-neutral-600">
                    Researchers can submit published studies for inclusion in our database by emailing the publication details to research@hydrogenstudies.com.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm">
                  <h4 className="font-semibold text-lg mb-3">Do you provide research consultation?</h4>
                  <p className="text-neutral-600">
                    Our team can provide guidance on hydrogen research resources. For specific consultation requests, please contact us directly.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm">
                  <h4 className="font-semibold text-lg mb-3">How often is the database updated?</h4>
                  <p className="text-neutral-600">
                    We update our research database monthly with newly published studies and findings in the field of hydrogen research.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm">
                  <h4 className="font-semibold text-lg mb-3">Can I request specific research topics?</h4>
                  <p className="text-neutral-600">
                    Yes! We welcome suggestions for research topics or specific studies to include. Please use our contact information to send your requests.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default AboutPage;
