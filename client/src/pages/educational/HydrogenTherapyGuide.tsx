import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'wouter';
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Droplet, 
  Wind, 
  Zap, 
  ShieldCheck, 
  Activity, 
  Heart, 
  Brain, 
  Pill, 
  BookOpen,
  MoveRight
} from 'lucide-react';
import JsonLd, { generateFaqSchema } from "@/components/seo/JsonLd";

// FAQ data for structured data and content
const hydrogenFaqs = [
  {
    question: "What is molecular hydrogen therapy?",
    answer: "Molecular hydrogen (H₂) therapy involves the administration of hydrogen gas, typically through hydrogen-rich water, hydrogen gas inhalation, or hydrogen baths. Hydrogen acts as a selective antioxidant that can penetrate cell membranes and neutralize harmful free radicals while preserving beneficial ones."
  },
  {
    question: "How does hydrogen therapy work in the body?",
    answer: "Hydrogen therapy works through several mechanisms: 1) It selectively neutralizes harmful free radicals like hydroxyl radicals while preserving beneficial ones, 2) It activates the Nrf2 pathway that regulates antioxidant proteins, 3) It reduces inflammatory responses and cytokine production, and 4) It influences cell signaling pathways and gene expression related to metabolism and cell survival."
  },
  {
    question: "What health conditions may benefit from hydrogen therapy?",
    answer: "Research suggests hydrogen therapy may benefit various conditions including metabolic disorders (diabetes, obesity), inflammatory conditions (arthritis, IBD), neurodegenerative diseases (Alzheimer's, Parkinson's), cardiovascular issues (hypertension, heart disease), respiratory conditions, liver and kidney function, athletic performance, and overall longevity."
  },
  {
    question: "What are the different ways to administer hydrogen therapy?",
    answer: "Hydrogen can be administered through multiple methods: 1) Drinking hydrogen-rich water, 2) Inhaling hydrogen gas, 3) Hydrogen baths or topical application, 4) Hydrogen sauna therapy, and 5) Hydrogen-generating supplements. Each delivery method has different bioavailability characteristics and potential applications."
  },
  {
    question: "Is hydrogen therapy supported by scientific research?",
    answer: "Yes, hydrogen therapy has been studied in hundreds of peer-reviewed scientific papers including cell studies, animal research, and human clinical trials. Research began gaining significant momentum after a landmark paper published in Nature Medicine in 2007, and the field has grown substantially since then with clinical trials investigating various applications of molecular hydrogen."
  }
];

const HydrogenTherapyGuide = () => {
  return (
    <>
      <Helmet>
        <title>Molecular Hydrogen Therapy: The Ultimate Guide | Benefits & Scientific Evidence</title>
        <meta 
          name="description" 
          content="Learn everything about molecular hydrogen therapy and its health benefits. Comprehensive guide covering the science, applications, and research evidence behind H2 therapy." 
        />
        <meta name="keywords" content="molecular hydrogen therapy, h2 health benefits, hydrogen water guide, hydrogen gas inhalation, hydrogen medicine, hydrogen therapy research" />
        <link rel="canonical" href="https://hydrogenstudies.com/educational/hydrogen-therapy-guide" />
        
        {/* Open Graph Tags */}
        <meta property="og:title" content="Complete Guide to Molecular Hydrogen Therapy | Science & Benefits" />
        <meta property="og:description" content="Discover how molecular hydrogen therapy works, its potential health benefits, and the science behind this innovative therapeutic approach." />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://hydrogenstudies.com/educational/hydrogen-therapy-guide" />
        <meta property="og:image" content="/og-hydrogen-therapy-guide.jpg" />
        
        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Molecular Hydrogen Therapy Guide: Science-Based Benefits" />
        <meta name="twitter:description" content="Comprehensive guide to molecular hydrogen therapy explaining the science, methods of administration, and potential health benefits based on research." />
      </Helmet>
      
      {/* Structured data using JsonLd component */}
      <JsonLd 
        type="FAQPage"
        data={generateFaqSchema(hydrogenFaqs)}
      />
      
      <JsonLd 
        type="Article"
        data={{
          headline: "The Complete Guide to Molecular Hydrogen Therapy",
          description: "Comprehensive overview of molecular hydrogen therapy, including its mechanisms, benefits, and application methods",
          image: "/og-hydrogen-therapy-guide.jpg",
          datePublished: "2025-05-21T00:00:00.000Z",
          dateModified: new Date().toISOString(),
          author: {
            "@type": "Organization",
            "name": "Hydrogen Studies Research Team"
          },
          publisher: {
            "@type": "Organization",
            "name": "Hydrogen Studies",
            "logo": {
              "@type": "ImageObject",
              "url": "https://hydrogenstudies.com/logo.png"
            }
          },
          about: [
            {
              "@type": "Thing",
              "name": "Molecular Hydrogen"
            },
            {
              "@type": "Thing",
              "name": "Medical Therapy"
            }
          ]
        }}
      />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 py-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-4">
                Molecular Hydrogen Therapy: <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">The Complete Guide</span>
              </h1>
              <p className="text-xl text-gray-700 mb-6">
                Discover the science, benefits, and applications of one of the most promising therapeutic approaches in health research.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" className="shadow-lg">
                  Browse Research Studies
                </Button>
                <Button size="lg" variant="outline">
                  Watch Video Guide
                </Button>
              </div>
            </div>
            <div className="flex-1 flex justify-center">
              <div className="relative w-full max-w-md aspect-square rounded-full bg-white p-4 shadow-xl">
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-400/30 to-indigo-400/30 flex items-center justify-center">
                  <div className="text-center">
                    <Droplet className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-800">H<sub>2</sub></h3>
                    <p className="text-gray-600">Molecular Hydrogen</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* What is Hydrogen Therapy Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">What is Molecular Hydrogen Therapy?</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Molecular hydrogen (H₂) therapy is a novel therapeutic approach that involves the administration of hydrogen gas to combat oxidative stress and inflammation in the body.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <ShieldCheck className="h-6 w-6 mr-2 text-primary" />
                Selective Antioxidant Properties
              </h3>
              <p className="text-gray-600">
                Unlike conventional antioxidants, molecular hydrogen selectively neutralizes only the most harmful free radicals, such as hydroxyl radicals, while preserving beneficial reactive oxygen species that are important for cell signaling.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Wind className="h-6 w-6 mr-2 text-primary" />
                Cell Membrane Penetration
              </h3>
              <p className="text-gray-600">
                As the smallest molecule in the universe, hydrogen can rapidly diffuse through cell membranes and reach cellular compartments that many other substances cannot, including mitochondria and the nucleus.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Activity className="h-6 w-6 mr-2 text-primary" />
                Anti-Inflammatory Effects
              </h3>
              <p className="text-gray-600">
                Research indicates that hydrogen therapy can reduce inflammatory markers and cytokine production, helping to modulate the immune response and potentially benefit inflammatory conditions.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Zap className="h-6 w-6 mr-2 text-primary" />
                Cell Signaling Modulation
              </h3>
              <p className="text-gray-600">
                Hydrogen may influence cell signaling pathways and gene expression related to metabolism, inflammation, and cell survival, potentially explaining its wide range of therapeutic effects.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Delivery Methods Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Hydrogen Therapy Delivery Methods</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Molecular hydrogen can be administered through various methods, each with different characteristics and potential applications.
            </p>
          </div>
          
          <Tabs defaultValue="water" className="w-full">
            <TabsList className="w-full max-w-2xl mx-auto flex justify-between mb-8">
              <TabsTrigger value="water" className="flex-1">Hydrogen Water</TabsTrigger>
              <TabsTrigger value="inhalation" className="flex-1">Gas Inhalation</TabsTrigger>
              <TabsTrigger value="bath" className="flex-1">Bath Therapy</TabsTrigger>
              <TabsTrigger value="topical" className="flex-1">Topical</TabsTrigger>
            </TabsList>
            
            <TabsContent value="water">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Droplet className="h-6 w-6 mr-2 text-blue-500" />
                    Hydrogen-Rich Water
                  </CardTitle>
                  <CardDescription>
                    The most common and convenient method of hydrogen administration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    Hydrogen-rich water is created by dissolving molecular hydrogen gas into water through various methods:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    <li>Electrolysis devices that separate water into hydrogen and oxygen</li>
                    <li>Magnesium-based tablets that react with water to produce hydrogen</li>
                    <li>Hydrogen gas infusion machines</li>
                    <li>Premade hydrogen water in special packaging</li>
                  </ul>
                  <p className="text-gray-700">
                    Typical concentration ranges from 0.5 to 1.6 parts per million (ppm), with research suggesting therapeutic benefits at these levels. Hydrogen-rich water is particularly suitable for metabolic, digestive, and systemic conditions.
                  </p>
                  <div className="mt-6">
                    <Link href="/explore-by-delivery-method/hydrogen-water">
                      <Button variant="outline" className="flex items-center">
                        View Hydrogen Water Studies
                        <MoveRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="inhalation">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Wind className="h-6 w-6 mr-2 text-indigo-500" />
                    Hydrogen Gas Inhalation
                  </CardTitle>
                  <CardDescription>
                    Direct inhalation of hydrogen gas for rapid delivery to the bloodstream and tissues
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    Hydrogen gas inhalation involves breathing a mixture of hydrogen gas and air:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    <li>Typically uses a 1-4% hydrogen gas concentration (well below the 4.6% flammability threshold)</li>
                    <li>Administered through specialized hydrogen inhalation machines</li>
                    <li>Sessions typically range from 30 minutes to 1 hour</li>
                    <li>Provides higher bioavailability than water-dissolved hydrogen</li>
                  </ul>
                  <p className="text-gray-700">
                    Hydrogen gas inhalation may be particularly effective for neurological, respiratory, and acute conditions due to its rapid delivery. Clinical settings often prefer this method for therapeutic applications.
                  </p>
                  <div className="mt-6">
                    <Link href="/explore-by-delivery-method/hydrogen-inhalation">
                      <Button variant="outline" className="flex items-center">
                        View Inhalation Studies
                        <MoveRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="bath">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Droplet className="h-6 w-6 mr-2 text-cyan-500" />
                    Hydrogen Bath Therapy
                  </CardTitle>
                  <CardDescription>
                    Immersion in hydrogen-rich water for topical absorption and relaxation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    Hydrogen baths involve immersing the body in water infused with molecular hydrogen:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    <li>Created using hydrogen-generating bath tablets or electrolysis devices</li>
                    <li>Typical bath sessions last 20-30 minutes</li>
                    <li>Hydrogen can be absorbed through the skin and mucous membranes</li>
                    <li>Often combined with magnesium or other minerals for enhanced effects</li>
                  </ul>
                  <p className="text-gray-700">
                    Hydrogen baths may be particularly beneficial for skin conditions, muscle recovery, and stress reduction. The warmth of the bath may enhance circulation and hydrogen absorption.
                  </p>
                  <div className="mt-6">
                    <Link href="/explore-by-delivery-method/hydrogen-bath">
                      <Button variant="outline" className="flex items-center">
                        View Bath Therapy Studies
                        <MoveRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="topical">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Droplet className="h-6 w-6 mr-2 text-teal-500" />
                    Topical Hydrogen Applications
                  </CardTitle>
                  <CardDescription>
                    Direct application to skin for localized effects
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    Topical hydrogen applications include various products designed for direct skin application:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    <li>Hydrogen-infused skin care products (creams, serums, masks)</li>
                    <li>Hydrogen water sprays for direct application</li>
                    <li>Hydrogen-generating patches or wraps</li>
                    <li>Hydrogen-rich water used in compresses</li>
                  </ul>
                  <p className="text-gray-700">
                    Topical applications may benefit skin conditions, localized inflammation, and wound healing. Research suggests hydrogen can penetrate the skin barrier to provide antioxidant effects in underlying tissues.
                  </p>
                  <div className="mt-6">
                    <Link href="/explore-by-delivery-method/topical-hydrogen">
                      <Button variant="outline" className="flex items-center">
                        View Topical Application Studies
                        <MoveRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
      
      {/* Potential Health Benefits Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Potential Health Benefits</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Research suggests molecular hydrogen may offer benefits across various health conditions and systems.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border border-blue-100 hover:shadow-md transition-shadow">
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center text-blue-700">
                  <Heart className="h-5 w-5 mr-2" />
                  Cardiovascular Health
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    </div>
                    <span>Reduction in oxidative stress markers</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    </div>
                    <span>Improved endothelial function</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    </div>
                    <span>Potential blood pressure regulation</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    </div>
                    <span>Protection against ischemia-reperfusion injury</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <Link href="/explore-by-body-system/cardiovascular system">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 p-0">
                      View cardiovascular studies →
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border border-purple-100 hover:shadow-md transition-shadow">
              <CardHeader className="bg-purple-50">
                <CardTitle className="flex items-center text-purple-700">
                  <Brain className="h-5 w-5 mr-2" />
                  Neurological Health
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                    </div>
                    <span>Neuroprotective effects against oxidative damage</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                    </div>
                    <span>Potential benefits in neurodegenerative conditions</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                    </div>
                    <span>Reduction in neuroinflammation</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                    </div>
                    <span>Improvement in cognitive function in some studies</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <Link href="/explore-by-body-system/nervous system">
                    <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-800 p-0">
                      View neurological studies →
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border border-green-100 hover:shadow-md transition-shadow">
              <CardHeader className="bg-green-50">
                <CardTitle className="flex items-center text-green-700">
                  <Activity className="h-5 w-5 mr-2" />
                  Metabolic Health
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    </div>
                    <span>Improved insulin sensitivity in some studies</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    </div>
                    <span>Potential regulation of blood glucose levels</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    </div>
                    <span>Anti-obesity effects in preliminary research</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    </div>
                    <span>Lipid profile improvements</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <Link href="/condition/metabolic syndrome">
                    <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-800 p-0">
                      View metabolic studies →
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="mt-12 text-center">
            <Link href="/explore-by-benefit">
              <Button className="shadow-md">
                Explore All Health Benefits
              </Button>
            </Link>
          </div>
        </div>
      </section>
      
      {/* Research Evidence Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">The Scientific Evidence</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Molecular hydrogen research has expanded significantly since 2007, with numerous studies published in peer-reviewed journals.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <BookOpen className="h-6 w-6 mr-2 text-primary" />
                Research Background
              </h3>
              <p className="text-gray-600 mb-4">
                The therapeutic potential of hydrogen gained attention after a 2007 study published in Nature Medicine demonstrated its selective antioxidant properties. Since then, research has expanded to include:
              </p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2 mt-0.5">
                    ✓
                  </div>
                  Cell studies investigating molecular mechanisms
                </li>
                <li className="flex items-start">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2 mt-0.5">
                    ✓
                  </div>
                  Animal research across various disease models
                </li>
                <li className="flex items-start">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2 mt-0.5">
                    ✓
                  </div>
                  Human clinical trials exploring therapeutic applications
                </li>
                <li className="flex items-start">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2 mt-0.5">
                    ✓
                  </div>
                  Systematic reviews and meta-analyses
                </li>
              </ul>
              <p className="text-gray-600 mt-4">
                While research is promising, many studies are preliminary or limited in size. Larger clinical trials are ongoing to establish definitive evidence.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-blue-600 mb-2">600+</div>
                <div className="text-gray-700">Published peer-reviewed studies</div>
              </div>
              
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-indigo-600 mb-2">60+</div>
                <div className="text-gray-700">Human clinical trials completed</div>
              </div>
              
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-purple-600 mb-2">30+</div>
                <div className="text-gray-700">Health conditions studied</div>
              </div>
              
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-teal-600 mb-2">15+</div>
                <div className="text-gray-700">Years of active research</div>
              </div>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <Link href="/studies">
              <Button className="shadow-md">
                Browse All Research Studies
              </Button>
            </Link>
          </div>
        </div>
      </section>
      
      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-lg text-gray-600">
              Common questions about molecular hydrogen therapy
            </p>
          </div>
          
          <div className="space-y-6">
            {hydrogenFaqs.map((faq, index) => (
              <Card key={index}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Explore Hydrogen Research Further</h2>
            <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
              Dive deeper into the science of molecular hydrogen and discover specific research for your health interests.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/improved-search">
                <Button variant="secondary" size="lg" className="font-semibold shadow-lg">
                  Search Research Database
                </Button>
              </Link>
              <Link href="/learn">
                <Button variant="outline" size="lg" className="bg-transparent border-white text-white hover:bg-white/10 font-semibold">
                  Educational Resources
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default HydrogenTherapyGuide;