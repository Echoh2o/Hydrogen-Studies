"use client";
// Body of /learn/therapy-guide, shared by the SPA page
// (educational/HydrogenTherapyGuide.tsx) and the Next.js front door. Uses
// wouter <Link> (needs a Router) and client-only UI (Tabs).
import React from "react";
import { Link } from "wouter";
import { Byline } from "@/components/blog/Byline";
import { LEARN_GUIDES_UPDATED, learnByline } from "@shared/learn-pages";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  MoveRight,
} from "lucide-react";
import { THERAPY_GUIDE_FAQS as hydrogenFaqs } from "@shared/learn-faqs";

export function HydrogenTherapyGuideContent() {
  return (
    <>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-teal-50 to-indigo-50 py-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-4">
                Molecular Hydrogen Therapy:{" "}
                <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-indigo-600">
                  What the Research Shows
                </span>
              </h1>
              <p className="text-xl text-gray-700 mb-6">
                A plain-English guide to how hydrogen is studied, how it&apos;s
                given, and what the evidence does — and doesn&apos;t — show.
              </p>
              <Byline byline={learnByline(LEARN_GUIDES_UPDATED)} className="byline text-sm text-gray-600 mb-6" />
              <div className="flex flex-wrap gap-4">
                <Link href="/studies">
                  <Button size="lg" className="shadow-lg">
                    Browse Research Studies
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex-1 flex justify-center">
              <div className="relative w-full max-w-md aspect-square rounded-full bg-white p-4 shadow-xl">
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-teal-400/30 to-indigo-400/30 flex items-center justify-center">
                  <div className="text-center">
                    <Droplet className="h-16 w-16 text-teal-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-800">
                      H<sub>2</sub>
                    </h3>
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
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              What is hydrogen therapy?
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              &quot;Hydrogen therapy&quot; is the research term for giving people
              or animals molecular hydrogen (H₂) — by drinking, breathing or
              bathing — to study its effects on oxidative stress and
              inflammation. It is not an approved treatment for any condition.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <ShieldCheck className="h-6 w-6 mr-2 text-primary" />
                Antioxidant Activity
              </h3>
              <p className="text-gray-600">
                In lab and animal studies, hydrogen acts as a mild antioxidant.
                The idea that it selectively neutralizes only the most harmful
                free radicals, such as hydroxyl radicals, comes mainly from cell
                and animal work, and later chemistry research questioned it.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Wind className="h-6 w-6 mr-2 text-primary" />
                Cell Membrane Penetration
              </h3>
              <p className="text-gray-600">
                As the smallest molecule there is, hydrogen diffuses easily
                through cell membranes without needing a transporter, including
                into mitochondria and the nucleus.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Activity className="h-6 w-6 mr-2 text-primary" />
                Inflammation Research
              </h3>
              <p className="text-gray-600">
                Many animal studies report lower inflammatory markers after
                hydrogen. Human trials are small, and their results are mixed.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Zap className="h-6 w-6 mr-2 text-primary" />
                Cell Signaling Modulation
              </h3>
              <p className="text-gray-600">
                Researchers have proposed that hydrogen affects cell signaling
                and gene expression (for example, the Nrf2 antioxidant pathway).
                These mechanisms come from lab and animal studies and are still
                debated.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Delivery Methods Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How is hydrogen given in studies?
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              In four main ways: drinking hydrogen water, breathing hydrogen
              gas, bathing and applying it to the skin. Each delivers a
              different amount, and few studies compare methods directly.
            </p>
          </div>

          <Tabs defaultValue="water" className="w-full">
            <TabsList className="w-full max-w-2xl mx-auto grid h-auto grid-cols-2 gap-1 sm:grid-cols-4 mb-8">
              <TabsTrigger value="water" className="flex-1">
                Hydrogen Water
              </TabsTrigger>
              <TabsTrigger value="inhalation" className="flex-1">
                Gas Inhalation
              </TabsTrigger>
              <TabsTrigger value="bath" className="flex-1">
                Baths
              </TabsTrigger>
              <TabsTrigger value="topical" className="flex-1">
                Topical
              </TabsTrigger>
            </TabsList>

            <TabsContent value="water">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Droplet className="h-6 w-6 mr-2 text-teal-500" />
                    Hydrogen-Rich Water
                  </CardTitle>
                  <CardDescription>
                    The most common way people take hydrogen at home
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    Hydrogen-rich water is created by dissolving molecular
                    hydrogen gas into water through various methods:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    <li>
                      Electrolysis devices that separate water into hydrogen and
                      oxygen
                    </li>
                    <li>
                      Magnesium-based tablets that react with water to produce
                      hydrogen
                    </li>
                    <li>Hydrogen gas infusion machines</li>
                    <li>Premade hydrogen water in special packaging</li>
                  </ul>
                  <p className="text-gray-700">
                    Most human drinking trials used roughly 0.5 to 1.6 parts per
                    million (ppm); no trial has shown that a higher
                    concentration works better. Dissolved hydrogen escapes
                    quickly, so water made right before drinking keeps more of
                    it.
                  </p>
                  <div className="mt-6">
                    <Link href="/explore-by-mechanism/hydrogen-water">
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
                    Breathing hydrogen gas mixed with air
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    Hydrogen gas inhalation involves breathing a mixture of
                    hydrogen gas and air:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    <li>
                      Studies have mostly used 1–4% hydrogen in air; hydrogen
                      is flammable in air from about 4%, so devices should only
                      be used as directed
                    </li>
                    <li>
                      Administered through specialized hydrogen inhalation
                      machines
                    </li>
                    <li>Session length varies widely between studies</li>
                    <li>
                      Can deliver more hydrogen in total than drinking water,
                      depending on concentration and duration
                    </li>
                  </ul>
                  <p className="text-gray-700">
                    Most inhalation research is in animals or in small hospital
                    studies. It has not been shown to treat any condition, and
                    home use has been studied far less.
                  </p>
                  <div className="mt-6">
                    <Link href="/explore-by-mechanism/hydrogen-inhalation">
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
                    Hydrogen Baths
                  </CardTitle>
                  <CardDescription>
                    Bathing in hydrogen-rich water
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    Hydrogen baths involve immersing the body in water infused
                    with molecular hydrogen:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    <li>
                      Created using hydrogen-generating bath tablets or
                      electrolysis devices
                    </li>
                    <li>Typical bath sessions last 20-30 minutes</li>
                    <li>
                      Hydrogen can pass through skin, but how much reaches the
                      body from a bath hasn&apos;t been well measured
                    </li>
                    <li>
                      Some bath products use magnesium to generate the hydrogen
                    </li>
                  </ul>
                  <p className="text-gray-700">
                    Research on hydrogen baths is limited to a few small
                    studies. Benefits for skin, muscle recovery or stress are
                    not established.
                  </p>
                  <div className="mt-6">
                    <Link href="/explore-by-mechanism/hydrogen-bath">
                      <Button variant="outline" className="flex items-center">
                        View Hydrogen Bath Studies
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
                    Products applied directly to the skin
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    Topical hydrogen applications include various products
                    designed for direct skin application:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    <li>
                      Hydrogen-infused skin care products (creams, serums,
                      masks)
                    </li>
                    <li>Hydrogen water sprays for direct application</li>
                    <li>Hydrogen-generating patches or wraps</li>
                    <li>Hydrogen-rich water used in compresses</li>
                  </ul>
                  <p className="text-gray-700">
                    Evidence for topical hydrogen comes mostly from lab and
                    animal studies, with few human trials. Effects on skin
                    conditions or wound healing are not established.
                  </p>
                  <div className="mt-6">
                    <Link href="/explore-by-mechanism/topical-hydrogen">
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
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              What are researchers studying?
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              These are the areas studied most. Much of the work is in animals
              or cells, and none of it shows that hydrogen treats a disease.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border border-teal-100 hover:shadow-md transition-shadow">
              <CardHeader className="bg-teal-50">
                <CardTitle className="flex items-center text-teal-700">
                  <Heart className="h-5 w-5 mr-2" />
                  Cardiovascular Health
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-teal-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-teal-500"></div>
                    </div>
                    <span>Oxidative stress markers — some small human trials</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-teal-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-teal-500"></div>
                    </div>
                    <span>Blood vessel (endothelial) function — a few small human trials</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-teal-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-teal-500"></div>
                    </div>
                    <span>Blood pressure — mixed results</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-teal-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-teal-500"></div>
                    </div>
                    <span>Heart and vessel injury — mostly animal studies</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <Link href="/explore-by-body-system/cardiovascular">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-teal-600 hover:text-teal-800 p-0"
                    >
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
                    <span>
                      Brain protection from oxidative damage — mostly animal
                      studies
                    </span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                    </div>
                    <span>
                      Neurodegenerative disease — mostly animal studies; small
                      human trials with mixed results
                    </span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                    </div>
                    <span>Brain inflammation — animal studies</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                    </div>
                    <span>
                      Cognitive function — a few small human trials, mixed
                      results
                    </span>
                  </li>
                </ul>
                <div className="mt-6">
                  <Link href="/explore-by-body-system/brain-nervous-system">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-purple-600 hover:text-purple-800 p-0"
                    >
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
                    <span>Insulin resistance — the main double-blind trial in type 2 diabetes found no change</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    </div>
                    <span>Blood glucose — small trials, mixed results</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    </div>
                    <span>Body weight — preliminary, mostly animal research</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center mr-2 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    </div>
                    <span>Blood lipids — modest changes in some small trials</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <Link href="/search?q=metabolic syndrome">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-green-600 hover:text-green-800 p-0"
                    >
                      Search metabolic studies →
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 text-center">
            <Link href="/explore-by-benefit">
              <Button className="shadow-md">Explore Research by Topic</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Research Evidence Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How strong is the evidence?
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Mostly early-stage. Molecular hydrogen research has grown since
              2007, but most of it is in cells and animals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <BookOpen className="h-6 w-6 mr-2 text-primary" />
                Research Background
              </h3>
              <p className="text-gray-600 mb-4">
                Interest in hydrogen grew after a 
                <Link
                  href="/study/hydrogen-acts-as-a-therapeutic-antioxidant-by-selectively-reducing-cytotoxic-oxygen-radicals-pmid-17486089"
                  className="text-teal-700 underline hover:text-teal-800"
                >
                  2007 study in Nature Medicine
                </Link> 
                reported antioxidant effects in cells and rats. Since then,
                research has included:
              </p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <div className="w-5 h-5 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center mr-2 mt-0.5">
                    ✓
                  </div>
                  Cell studies investigating molecular mechanisms
                </li>
                <li className="flex items-start">
                  <div className="w-5 h-5 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center mr-2 mt-0.5">
                    ✓
                  </div>
                  Animal research across various disease models
                </li>
                <li className="flex items-start">
                  <div className="w-5 h-5 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center mr-2 mt-0.5">
                    ✓
                  </div>
                  Human trials, mostly small and short
                </li>
                <li className="flex items-start">
                  <div className="w-5 h-5 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center mr-2 mt-0.5">
                    ✓
                  </div>
                  Systematic reviews and meta-analyses
                </li>
              </ul>
              <p className="text-gray-600 mt-4">
                Most studies are preliminary or small, and several human trials
                found no clear effect. Larger, well-controlled trials are
                needed before firm conclusions can be drawn.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-teal-600 mb-2">
                  2,000+
                </div>
                <div className="text-gray-700">
                  Published studies in our database
                </div>
              </div>

              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-indigo-600 mb-2">
                  Most
                </div>
                <div className="text-gray-700">
                  Are cell or animal studies
                </div>
              </div>

              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  170+
                </div>
                <div className="text-gray-700">Health conditions studied</div>
              </div>

              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-teal-600 mb-2">2007</div>
                <div className="text-gray-700">Research took off</div>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/studies">
              <Button className="shadow-md">Browse All Research Studies</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-gray-600">
              Common questions about hydrogen research
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
      <section className="py-16 bg-gradient-to-r from-teal-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">
              Explore Hydrogen Research Further
            </h2>
            <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
              Dive deeper into the science of molecular hydrogen and discover
              specific research for your health interests.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/improved-search">
                <Button
                  variant="secondary"
                  size="lg"
                  className="font-semibold shadow-lg"
                >
                  Search Research Database
                </Button>
              </Link>
              <Link href="/learn">
                <Button
                  variant="outline"
                  size="lg"
                  className="bg-transparent border-white text-white hover:bg-white/10 font-semibold"
                >
                  Educational Resources
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
