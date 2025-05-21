import { Helmet } from "react-helmet";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import ContactForm from "@/components/contact/ContactForm";

export default function Resources() {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("researchers");
  
  useEffect(() => {
    // Check if there's a hash in the URL and set the active tab accordingly
    const hash = location.split('#')[1];
    if (hash && ["researchers", "healthcare", "bibliography", "methodology", "contact"].includes(hash)) {
      setActiveTab(hash);
    }
  }, [location]);
  
  return (
    <>
      <Helmet>
        <title>Hydrogen Therapy Resources | Research Tools & Clinical Guidelines</title>
        <meta
          name="description"
          content="Access comprehensive hydrogen therapy resources including research protocols, clinical guidelines, patient materials, and citation tools for scientists and healthcare providers."
        />
        <meta name="keywords" content="hydrogen therapy resources, molecular hydrogen research, h2 clinical guidelines, hydrogen medical protocols, hydrogen research methodology, hydrogen therapy tools" />
        <link rel="canonical" href="https://hydrogenstudies.com/resources" />
        
        {/* Open Graph Tags */}
        <meta property="og:title" content="Hydrogen Therapy Resources | Research & Clinical Tools" />
        <meta property="og:description" content="Comprehensive collection of hydrogen therapy resources for researchers, healthcare providers, and those interested in molecular hydrogen applications." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/resources" />
        <meta property="og:image" content="/og-resources-image.jpg" />
        
        {/* Twitter Card Tags */}
        <meta name="twitter:title" content="Hydrogen Therapy Resources | Research & Clinical Tools" />
        <meta name="twitter:description" content="Access research protocols, clinical guidelines, and educational materials about molecular hydrogen therapy from the definitive hydrogen studies database." />
        
        {/* Schema.org structured data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "Hydrogen Therapy Resources",
            "description": "Comprehensive resources for hydrogen therapy research and clinical applications",
            "url": "https://hydrogenstudies.com/resources",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Research Frameworks",
                "description": "Standardized methodologies and protocols for hydrogen research",
                "url": "https://hydrogenstudies.com/resources#researchers"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Clinical Guidelines",
                "description": "Evidence-based recommendations for clinical applications of hydrogen therapy",
                "url": "https://hydrogenstudies.com/resources#healthcare"
              },
              {
                "@type": "ListItem",
                "position": 3,
                "name": "Bibliography Tools",
                "description": "Citation formats and reference management for hydrogen research literature",
                "url": "https://hydrogenstudies.com/resources#bibliography"
              },
              {
                "@type": "ListItem",
                "position": 4,
                "name": "Research Methodology",
                "description": "Standards and processes for evaluating hydrogen therapy research",
                "url": "https://hydrogenstudies.com/resources#methodology"
              },
              {
                "@type": "ListItem",
                "position": 5,
                "name": "Contact Information",
                "description": "Get in touch with the Hydrogen Studies research team",
                "url": "https://hydrogenstudies.com/resources#contact"
              }
            ]
          })}
        </script>
      </Helmet>
      
      <div className="bg-neutral-100 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">Resources</h1>
            <p className="text-neutral-600 mb-8">
              Access helpful resources, tools, and information for hydrogen research.
            </p>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <div className="overflow-x-auto pb-2">
                <TabsList className="inline-flex w-auto min-w-max border rounded-lg p-1 gap-1">
                  <TabsTrigger value="researchers" className="flex-1 whitespace-nowrap px-3">For Researchers</TabsTrigger>
                  <TabsTrigger value="healthcare" className="flex-1 whitespace-nowrap px-3">Healthcare Providers</TabsTrigger>
                  <TabsTrigger value="bibliography" className="flex-1 whitespace-nowrap px-3">Bibliography Tools</TabsTrigger>
                  <TabsTrigger value="methodology" className="flex-1 whitespace-nowrap px-3">Methodology</TabsTrigger>
                  <TabsTrigger value="contact" className="flex-1 whitespace-nowrap px-3">Contact Us</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="researchers" id="researchers">
                <Card>
                  <CardHeader>
                    <CardTitle>Resources for Researchers</CardTitle>
                    <CardDescription>
                      Tools and information to support your hydrogen gas research.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <section>
                      <h3 className="text-lg font-bold mb-2">Research Frameworks</h3>
                      <p className="text-neutral-700 mb-4">
                        Access standardized methodologies and protocols for hydrogen research:
                      </p>
                      <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
                        <li>Hydrogen measurement techniques and standards</li>
                        <li>Biomarker assessment protocols for hydrogen studies</li>
                        <li>Reporting guidelines for hydrogen intervention trials</li>
                        <li>Chemical safety protocols for hydrogen gas handling</li>
                      </ul>
                    </section>
                    
                    <Separator />
                    
                    <section>
                      <h3 className="text-lg font-bold mb-2">Collaboration Opportunities</h3>
                      <p className="text-neutral-700 mb-4">
                        Connect with other researchers in the field:
                      </p>
                      <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
                        <li>Join the International Hydrogen Research Consortium</li>
                        <li>Participate in multi-center clinical trials</li>
                        <li>Apply for research grants and funding opportunities</li>
                        <li>Attend upcoming conferences and symposia</li>
                      </ul>
                    </section>
                    
                    <Separator />
                    
                    <section>
                      <h3 className="text-lg font-bold mb-2">Data Analysis Tools</h3>
                      <p className="text-neutral-700 mb-4">
                        Statistical resources specifically designed for hydrogen research:
                      </p>
                      <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
                        <li>Effect size calculators for hydrogen interventions</li>
                        <li>Meta-analysis templates for hydrogen studies</li>
                        <li>Statistical power calculators for trial design</li>
                      </ul>
                    </section>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="healthcare" id="healthcare">
                <Card>
                  <CardHeader>
                    <CardTitle>For Healthcare Providers</CardTitle>
                    <CardDescription>
                      Evidence-based information on hydrogen applications in clinical settings.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <section>
                      <h3 className="text-lg font-bold mb-2">Clinical Guidelines</h3>
                      <p className="text-neutral-700 mb-4">
                        Current evidence-based recommendations for clinical applications:
                      </p>
                      <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
                        <li>Hydrogen therapy protocols for various conditions</li>
                        <li>Patient monitoring guidelines during hydrogen therapy</li>
                        <li>Contraindications and safety considerations</li>
                        <li>Integration with conventional treatments</li>
                      </ul>
                    </section>
                    
                    <Separator />
                    
                    <section>
                      <h3 className="text-lg font-bold mb-2">Patient Education Materials</h3>
                      <p className="text-neutral-700 mb-4">
                        Resources to help inform patients about hydrogen therapy:
                      </p>
                      <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
                        <li>Printable information sheets about hydrogen therapy</li>
                        <li>Visual guides to explain mechanisms of action</li>
                        <li>FAQs addressing common patient questions</li>
                        <li>Home-use guidelines for patient self-administration</li>
                      </ul>
                    </section>
                    
                    <Separator />
                    
                    <section>
                      <h3 className="text-lg font-bold mb-2">Continuing Education</h3>
                      <p className="text-neutral-700 mb-4">
                        Professional development opportunities in hydrogen medicine:
                      </p>
                      <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
                        <li>Online courses on molecular hydrogen in clinical practice</li>
                        <li>Webinars featuring leading researchers and clinicians</li>
                        <li>Case study discussions and clinical rounds</li>
                      </ul>
                    </section>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="bibliography" id="bibliography">
                <Card>
                  <CardHeader>
                    <CardTitle>Bibliography Tools</CardTitle>
                    <CardDescription>
                      Tools for citing and managing hydrogen research literature.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <section>
                      <h3 className="text-lg font-bold mb-2">Citation Formats</h3>
                      <p className="text-neutral-700 mb-4">
                        Download citations in multiple formats:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button variant="outline" className="w-full justify-start px-4">APA Format</Button>
                        <Button variant="outline" className="w-full justify-start px-4">MLA Format</Button>
                        <Button variant="outline" className="w-full justify-start px-4">Chicago Style</Button>
                        <Button variant="outline" className="w-full justify-start px-4">Harvard Style</Button>
                        <Button variant="outline" className="w-full justify-start px-4">BibTeX Format</Button>
                        <Button variant="outline" className="w-full justify-start px-4">RIS Format</Button>
                      </div>
                    </section>
                    
                    <Separator />
                    
                    <section>
                      <h3 className="text-lg font-bold mb-2">Reference Management</h3>
                      <p className="text-neutral-700 mb-4">
                        Integration with popular reference management software:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button variant="outline" className="w-full justify-start px-4">Export to Mendeley</Button>
                        <Button variant="outline" className="w-full justify-start px-4">Export to Zotero</Button>
                        <Button variant="outline" className="w-full justify-start px-4">Export to EndNote</Button>
                        <Button variant="outline" className="w-full justify-start px-4">Export to RefWorks</Button>
                      </div>
                    </section>
                    
                    <Separator />
                    
                    <section>
                      <h3 className="text-lg font-bold mb-2">Bulk Operations</h3>
                      <p className="text-neutral-700 mb-4">
                        Tools for managing multiple citations:
                      </p>
                      <div className="space-y-4">
                        <Button className="w-full sm:w-auto justify-start px-4">Batch Export Citations</Button>
                        <p className="text-sm text-neutral-600">
                          Create customized bibliographies by selecting multiple studies from our database and exporting them in your preferred format.
                        </p>
                      </div>
                    </section>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="methodology" id="methodology">
                <Card>
                  <CardHeader>
                    <CardTitle>Methodology</CardTitle>
                    <CardDescription>
                      Learn about how we collect, evaluate, and present hydrogen research.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <section>
                      <h3 className="text-lg font-bold mb-2">Database Criteria</h3>
                      <p className="text-neutral-700 mb-4">
                        Our standards for including studies in the database:
                      </p>
                      <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
                        <li>Focus on peer-reviewed research in reputable journals</li>
                        <li>Inclusion of both clinical and pre-clinical studies</li>
                        <li>Quality assessment using standardized tools</li>
                        <li>Regular updates to incorporate new research</li>
                        <li>Comprehensive coverage across research domains</li>
                      </ul>
                    </section>
                    
                    <Separator />
                    
                    <section>
                      <h3 className="text-lg font-bold mb-2">Classification System</h3>
                      <p className="text-neutral-700 mb-4">
                        How we organize and categorize research:
                      </p>
                      <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
                        <li>Primary categorization by health domain/condition</li>
                        <li>Secondary classification by study type (RCT, cohort, etc.)</li>
                        <li>Tagging system for mechanisms of action</li>
                        <li>Administration method categorization</li>
                        <li>Evidence level assessment based on study design and quality</li>
                      </ul>
                    </section>
                    
                    <Separator />
                    
                    <section>
                      <h3 className="text-lg font-bold mb-2">Data Extraction Process</h3>
                      <p className="text-neutral-700 mb-4">
                        Our methodology for extracting and presenting study data:
                      </p>
                      <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
                        <li>Standardized data extraction forms used by trained reviewers</li>
                        <li>Dual extraction and reconciliation for accuracy</li>
                        <li>Focus on intervention details, outcomes, and statistical significance</li>
                        <li>Original author contact when clarification is needed</li>
                        <li>Regular quality audits of database entries</li>
                      </ul>
                    </section>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="contact" id="contact">
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Us</CardTitle>
                    <CardDescription>
                      Get in touch with the Hydrogen Studies team.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <section>
                      <h3 className="text-lg font-bold mb-2">Send Us a Message</h3>
                      <p className="text-neutral-700 mb-4">
                        Fill out the form below and we'll get back to you as soon as possible.
                      </p>
                      
                      <ContactForm />
                    </section>
                    
                    <Separator />
                    
                    <section>
                      <h3 className="text-lg font-bold mb-2">General Inquiries</h3>
                      <p className="text-neutral-700 mb-2">
                        For general questions about the database or hydrogen research:
                      </p>
                      <p className="text-primary font-medium">info@hydrogenstudies.com</p>
                    </section>
                    
                    <Separator />
                    
                    <section>
                      <h3 className="text-lg font-bold mb-2">Research Submissions</h3>
                      <p className="text-neutral-700 mb-2">
                        To submit published research for inclusion in our database:
                      </p>
                      <p className="text-primary font-medium">submissions@hydrogenstudies.com</p>
                      <p className="text-sm text-neutral-600 mt-2">
                        Please include the full citation and DOI of the paper in your submission.
                      </p>
                    </section>
                    
                    <Separator />
                    
                    <section>
                      <h3 className="text-lg font-bold mb-2">Technical Support</h3>
                      <p className="text-neutral-700 mb-2">
                        For issues related to website functionality or account access:
                      </p>
                      <p className="text-primary font-medium">support@hydrogenstudies.com</p>
                    </section>
                    
                    <Separator />
                    
                    <section>
                      <h3 className="text-lg font-bold mb-2">Follow Us</h3>
                      <p className="text-neutral-700 mb-4">
                        Stay connected with us on social media for the latest updates:
                      </p>
                      <div className="flex space-x-4">
                        <a href="#" className="text-neutral-600 hover:text-primary transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                            <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
                          </svg>
                        </a>
                        <a href="#" className="text-neutral-600 hover:text-primary transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                            <rect x="2" y="9" width="4" height="12"></rect>
                            <circle cx="4" cy="4" r="2"></circle>
                          </svg>
                        </a>
                        <a href="#" className="text-neutral-600 hover:text-primary transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                          </svg>
                        </a>
                      </div>
                    </section>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  );
}
