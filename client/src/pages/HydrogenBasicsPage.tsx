import React from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Atom,
  Heart,
  Shield,
  Droplets,
  Wind,
  Bath,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { Helmet } from "react-helmet";

export default function HydrogenBasicsPage() {
  const deliveryMethods = [
    {
      method: "Hydrogen Water",
      icon: <Droplets className="h-6 w-6 text-teal-600" />,
      description: "Drinking water infused with dissolved molecular hydrogen",
      benefits: ["Easy to consume", "Convenient for daily use", "Portable"],
      studies: 450,
      typical_dose: "1-2 liters daily",
    },
    {
      method: "Inhalation Therapy",
      icon: <Wind className="h-6 w-6 text-green-600" />,
      description: "Breathing hydrogen gas through specialized equipment",
      benefits: [
        "Direct lung absorption",
        "Fast-acting",
        "High bioavailability",
      ],
      studies: 320,
      typical_dose: "2-4% concentration",
    },
    {
      method: "Hydrogen Baths",
      icon: <Bath className="h-6 w-6 text-purple-600" />,
      description: "Bathing in water infused with hydrogen gas",
      benefits: [
        "Skin absorption",
        "Relaxing experience",
        "Full-body exposure",
      ],
      studies: 85,
      typical_dose: "15-30 minute sessions",
    },
  ];

  const keyMechanisms = [
    {
      title: "Selective Antioxidant",
      description:
        "Hydrogen targets only harmful free radicals while preserving beneficial ones",
      detail:
        "Unlike other antioxidants, hydrogen specifically neutralizes hydroxyl radicals and peroxynitrite without affecting important signaling molecules.",
    },
    {
      title: "Anti-Inflammatory",
      description: "Reduces inflammation by modulating inflammatory pathways",
      detail:
        "Studies show hydrogen can suppress pro-inflammatory cytokines and activate anti-inflammatory responses throughout the body.",
    },
    {
      title: "Cellular Protection",
      description: "Protects cells from oxidative stress and damage",
      detail:
        "Hydrogen can penetrate cell membranes and reach mitochondria, protecting cellular energy production and DNA.",
    },
  ];

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>Hydrogen Basics - Understanding Molecular Hydrogen Therapy</title>
        <meta name="description" content="Learn the fundamentals of molecular hydrogen therapy. Understand how H2 works, delivery methods, and the science behind hydrogen health benefits." />
        <meta property="og:title" content="Hydrogen Basics - Understanding Molecular Hydrogen Therapy" />
        <meta property="og:description" content="Learn the fundamentals of molecular hydrogen therapy. Understand how H2 works, delivery methods, and the science behind hydrogen health benefits." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/hydrogen-basics" />
        <meta name="twitter:card" content="summary" />
        <link rel="canonical" href="https://hydrogenstudies.com/hydrogen-basics" />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
        {/* Navigation */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link
              href="/learn"
              className="flex items-center text-teal-600 hover:text-teal-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Learn
            </Link>
          </div>
        </div>

        {/* Hero */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <Atom className="h-16 w-16 text-teal-600 mx-auto mb-6" />
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Hydrogen Therapy
              <span className="bg-gradient-to-r from-teal-600 to-purple-600 bg-clip-text text-transparent">
                {" "}
                Basics
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Everything you need to know about molecular hydrogen and its
              potential health benefits
            </p>
            <Badge className="bg-teal-100 text-teal-800 px-4 py-2">
              Based on 1,300+ peer-reviewed studies
            </Badge>
          </div>
        </section>

        {/* What is Molecular Hydrogen */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              What is Molecular Hydrogen?
            </h2>

            <div className="prose prose-lg max-w-none text-gray-700">
              <div className="bg-teal-50 p-6 rounded-lg mb-8">
                <p className="text-lg font-medium text-teal-900 mb-4">
                  Molecular hydrogen (H₂) is a colorless, odorless gas composed
                  of two hydrogen atoms. It's the smallest and lightest molecule
                  in the universe.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    Key Properties
                  </h3>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <Shield className="h-4 w-4 text-green-600 mr-2" />
                      Non-toxic and safe
                    </li>
                    <li className="flex items-center">
                      <Atom className="h-4 w-4 text-teal-600 mr-2" />
                      Smallest molecular size
                    </li>
                    <li className="flex items-center">
                      <Heart className="h-4 w-4 text-red-600 mr-2" />
                      Crosses biological barriers easily
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    How It Works
                  </h3>
                  <p className="text-gray-600">
                    Due to its tiny size, hydrogen can penetrate cell membranes
                    and reach areas other antioxidants cannot, including the
                    brain, mitochondria, and nucleus.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Key Mechanisms */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
              How Hydrogen Works in Your Body
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {keyMechanisms.map((mechanism, index) => (
                <Card key={index} className="border-t-4 border-t-teal-600">
                  <CardHeader>
                    <CardTitle className="text-lg">{mechanism.title}</CardTitle>
                    <CardDescription>{mechanism.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">{mechanism.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Delivery Methods */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
              Ways to Use Hydrogen Therapy
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {deliveryMethods.map((method, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center space-x-3 mb-4">
                      {method.icon}
                      <CardTitle className="text-lg">{method.method}</CardTitle>
                    </div>
                    <CardDescription>{method.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="font-medium text-gray-700 mb-2">
                        Benefits:
                      </p>
                      <ul className="space-y-1">
                        {method.benefits.map((benefit, i) => (
                          <li
                            key={i}
                            className="text-sm text-gray-600 flex items-center"
                          >
                            <div className="h-1.5 w-1.5 bg-teal-600 rounded-full mr-2"></div>
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="pt-4 border-t space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">
                          Supporting studies:
                        </span>
                        <Badge variant="outline">{method.studies}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Typical usage:</span>
                        <span className="font-medium">
                          {method.typical_dose}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Safety Information */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-teal-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Safety & Considerations
            </h2>

            <Alert className="mb-8">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Always consult with a healthcare
                professional before starting any hydrogen therapy, especially if
                you have existing medical conditions or take medications.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-700">
                    Generally Safe
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-gray-600">
                    ✓ No known serious side effects
                  </p>
                  <p className="text-sm text-gray-600">
                    ✓ Well-tolerated by most people
                  </p>
                  <p className="text-sm text-gray-600">
                    ✓ Decades of safe use in medical settings
                  </p>
                  <p className="text-sm text-gray-600">
                    ✓ Natural molecule produced by gut bacteria
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-orange-700">
                    Considerations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-gray-600">
                    • Start with lower doses
                  </p>
                  <p className="text-sm text-gray-600">
                    • Monitor your body's response
                  </p>
                  <p className="text-sm text-gray-600">
                    • Quality matters - use reputable sources
                  </p>
                  <p className="text-sm text-gray-600">
                    • Individual results may vary
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              Ready to Learn More?
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link href="/learn/health-benefits">
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <Heart className="h-8 w-8 text-red-600 mx-auto mb-2" />
                    <CardTitle className="text-center">
                      Health Benefits
                    </CardTitle>
                    <CardDescription className="text-center">
                      Explore specific health conditions hydrogen may support
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/studies">
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <Shield className="h-8 w-8 text-teal-600 mx-auto mb-2" />
                    <CardTitle className="text-center">View Research</CardTitle>
                    <CardDescription className="text-center">
                      Browse our database of peer-reviewed studies
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/chat">
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <Atom className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <CardTitle className="text-center">Ask Questions</CardTitle>
                    <CardDescription className="text-center">
                      Get personalized answers from our AI assistant
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
