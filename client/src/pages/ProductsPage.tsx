import { useState } from "react";
import { Link, useLocation } from "wouter";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";
import {
  ArrowLeft,
  ShoppingCart,
  Award,
  Droplets,
  Heart,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Mail,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import JsonLd, { generateProductSchema } from "@/components/seo/JsonLd";
import { buildEchoUrl, echoProductUrl, ECHO_PRODUCTS, pageContextFromPath } from "@shared/echo-products";
import { trackOutboundClick } from "@/lib/analytics";

// This component only renders at /products → utm_campaign=products&utm_content=products
// (same derivation as the bot renderer's pageContextFromPath).
const PRODUCTS_CTX = pageContextFromPath("/products");
const echoContactUrl = buildEchoUrl("/pages/contact", PRODUCTS_CTX);

// Buyer's Guide email capture modal
function BuyersGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "loading") return;
    setStatus("loading");
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "buyers_guide_download" }),
      });
      const data = await response.json();
      if (data.success) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl p-8">
        {status === "success" ? (
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-teal-500 mx-auto mb-4" />
            <DialogTitle className="text-xl font-bold mb-2">Check Your Inbox!</DialogTitle>
            <DialogDescription className="text-gray-600 mb-4">
              Your Hydrogen Delivery Methods Comparison Guide is on its way.
            </DialogDescription>
            <Button onClick={onClose} className="bg-teal-600 hover:bg-teal-700">
              Continue Browsing
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="text-center mb-6">
              <div className="mx-auto mb-4 p-3 rounded-full bg-teal-50 w-fit">
                <Download className="h-8 w-8 text-teal-600" />
              </div>
              <DialogTitle className="text-xl font-bold mb-2 text-center">
                Free: Hydrogen Delivery Methods Guide
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-sm text-center">
                Compare drinking, inhalation, and bathing methods side-by-side,
                and see how much research exists for each.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-2 mb-6 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-500 flex-shrink-0" />
                Side-by-side comparison of all 3 delivery methods
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-500 flex-shrink-0" />
                Pros and cons, with study citations
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-500 flex-shrink-0" />
                What to check before you buy
              </li>
            </ul>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700"
                disabled={status === "loading"}
              >
                {status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Send Me the Free Guide
              </Button>
              {status === "error" && (
                <p className="text-red-500 text-sm text-center">Something went wrong. Please try again.</p>
              )}
              <p className="text-xs text-gray-400 text-center">
                No spam. Unsubscribe anytime.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProductImage({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <svg
          className="h-16 w-16 text-teal-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-contain p-2"
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}

export default function ProductsPage() {
  const [location] = useLocation();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Parse filter from URL params
  const params = new URLSearchParams(location.split("?")[1] || "");
  const activeFilter = params.get("filter");

  const products = [
    {
      id: 1,
      name: "Echo Flask Hydrogen Water Bottle",
      price: "Visit Store",
      originalPrice: null,
      description:
        "A portable hydrogen water bottle with app-based hydration tracking and adjustable settings. Echo states up to 8 ppm dissolved hydrogen.",
      features: [
        "Up to 8 ppm H\u2082 (manufacturer-stated)",
        "Hydration tracking",
        "Customizable settings",
        "Portable",
      ],
      image: "/images/products/echo-flask.webp",
      badge: "Hydrogen Water Bottle",
      url: echoProductUrl(ECHO_PRODUCTS.flask, PRODUCTS_CTX),
      deliveryMethod: "drinking-water",
      h2Concentration: "Up to 8 ppm*",
      bestFor: "Daily hydration, portability",
    },
    {
      id: 2,
      name: "Hydrogen Prebiotic Stick Pack (30-pack)",
      price: "Visit Store",
      originalPrice: null,
      description:
        "A powdered drink mix that releases hydrogen when added to water, combined with a prebiotic fiber. Single-serve packets.",
      features: [
        "Releases hydrogen in water",
        "Contains prebiotic fiber",
        "Single-serve packets",
        "No device needed",
      ],
      image: "/images/products/echo-drink-mix.webp",
      badge: "Powdered Drink Mix",
      url: echoProductUrl(ECHO_PRODUCTS.prebiotic, PRODUCTS_CTX),
      deliveryMethod: "drinking-water",
      h2Concentration: "Up to 16 ppm*",
      bestFor: "Travel, no device",
    },
    {
      id: 3,
      name: "Echo H2\u00AE Hydrogen Water Machine",
      price: "Visit Store",
      originalPrice: null,
      description:
        "The Echo H2 is a countertop hydrogen water machine that connects to your existing faucet. Produces hydrogen-enriched, filtered water on demand.",
      features: [
        "Countertop hydrogen water",
        "Built-in filtration",
        "On-demand H2 production",
        "Easy faucet installation",
      ],
      image: "/images/products/echo-h2.webp",
      badge: "Hydrogen Water Machine",
      url: echoProductUrl(ECHO_PRODUCTS.h2Machine, PRODUCTS_CTX),
      deliveryMethod: "drinking-water",
      h2Concentration: "Up to 1.5 ppm*",
      bestFor: "Daily home use",
    },
    {
      id: 4,
      name: "Echo Forty\u2122 Hydrogen Water Tumbler",
      price: "Visit Store",
      originalPrice: null,
      description:
        "The Echo Forty is a smart hydrogen water tumbler with a built-in touchscreen display. Generates hydrogen-rich water anywhere with 40 oz capacity.",
      features: [
        "40 oz capacity",
        "Smart touchscreen display",
        "Portable electrolysis",
        "Up to 4.5 ppm H\u2082 (manufacturer-stated)",
      ],
      image: "/images/products/echo-forty.webp",
      badge: "Hydrogen Water Bottle",
      url: echoProductUrl(ECHO_PRODUCTS.forty, PRODUCTS_CTX),
      deliveryMethod: "drinking-water",
      h2Concentration: "Up to 4.5 ppm*",
      bestFor: "On-the-go, large capacity",
    },
    {
      id: 5,
      name: "Echo One\u2122 Hydrogen Water Machine",
      price: "Visit Store",
      originalPrice: null,
      description:
        "An under-counter hydrogen water machine with RGB lighting that makes hydrogen water on demand.",
      features: [
        "Under-counter installation",
        "Premium design with RGB lighting",
        "On-demand hydrogen water",
        "Whole-household use",
      ],
      image: "/images/products/echo-one.webp",
      badge: "Hydrogen Water Machine",
      url: echoProductUrl(ECHO_PRODUCTS.one, PRODUCTS_CTX),
      deliveryMethod: "drinking-water",
      h2Concentration: "Up to 1.5 ppm*",
      bestFor: "Premium home installation",
    },
    {
      id: 6,
      name: "Echo Refresh\u2122 Hydrogen Inhalation Machine",
      price: "Visit Store",
      originalPrice: null,
      description:
        "A machine that produces hydrogen gas for inhalation through a nasal cannula. Inhalation is how hydrogen was given in many clinical studies.",
      features: [
        "Hydrogen gas inhalation",
        "Nasal cannula delivery",
        "Touchscreen display with timer",
        "Home use",
      ],
      image: "/images/products/echo-refresh.webp",
      badge: "Inhalation",
      url: echoProductUrl(ECHO_PRODUCTS.refresh, PRODUCTS_CTX),
      deliveryMethod: "inhalation",
      h2Concentration: "2% H\u2082 gas*",
      bestFor: "Inhalation at home",
    },
    {
      id: 7,
      name: "Echo Revive\u2122 Hydrogen Bath Machine",
      price: "Visit Store",
      originalPrice: null,
      description:
        "A machine that adds hydrogen to bath water. Hydrogen baths are much less studied than drinking or inhalation.",
      features: [
        "Hydrogen-rich bath water",
        "Works in a standard tub",
        "Bath-time use",
        "Least-studied delivery method",
      ],
      image: "/images/products/echo-revive.webp",
      badge: "Bathing",
      url: echoProductUrl(ECHO_PRODUCTS.revive, PRODUCTS_CTX),
      deliveryMethod: "bathing",
      h2Concentration: "Up to 1.5 ppm*",
      bestFor: "Bathing",
    },
  ];

  const filteredProducts = activeFilter
    ? products.filter((p) => p.deliveryMethod === activeFilter)
    : products;

  const benefits = [
    {
      icon: <Zap className="h-6 w-6 text-yellow-500" />,
      title: "Exercise & Fatigue",
      description: "Some small trials report lower blood lactate or perceived fatigue after exercise; others found no difference.",
    },
    {
      icon: <Award className="h-6 w-6 text-teal-500" />,
      title: "Antioxidant Markers",
      description: "A mild antioxidant in lab and animal studies; results in people are inconsistent.",
    },
    {
      icon: <Heart className="h-6 w-6 text-red-500" />,
      title: "Safety",
      description: "Well tolerated in short trials. Long-term safety hasn't been studied.",
    },
  ];

  const faqs = [
    {
      question: "What is hydrogen water?",
      answer: "Water with dissolved molecular hydrogen (H\u2082) gas. In lab and animal studies hydrogen acts as a mild antioxidant. Human trials so far are mostly small and short, with mixed results \u2014 our topic pages grade the evidence for each outcome.",
    },
    {
      question: "Which product is right for me?",
      answer: "Most human drinking trials used hydrogen water (machines, bottles, tablets or powders), so that is the best-studied way to take it. Inhalation was used in many hospital studies. Hydrogen baths have very little research. Choose on convenience and on independently tested concentration at the time you drink.",
    },
    {
      question: "How does Echo Water compare to other brands?",
      answer: "We can't give you an independent comparison: Echo Water's parent company funds this site. The concentrations listed here are Echo's own figures. When comparing any brand, look for third-party testing of dissolved hydrogen at the time you drink, not just the maximum on the label.",
    },
    {
      question: "Is hydrogen water safe to drink?",
      answer: "In human trials so far it has been well tolerated; reported side effects were mild, such as loose stools or bloating, mostly with magnesium-based tablets. The trials are small and short, so long-term safety hasn't been studied. If you're pregnant, take medication or have a medical condition, talk to your doctor first.",
    },
    {
      question: "Will I notice a difference?",
      answer: "There's no reliable answer. Some exercise trials measured changes after a single session; trials of blood markers ran 4 to 24 weeks, and many found little or no difference from placebo. Hydrogen water is not a treatment for any disease.",
    },
    {
      question: "Do the products have a warranty?",
      answer: "Warranty and return terms vary by product and are set by Echo Water. See echowater.com for current details.",
    },
  ];

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>Molecular Hydrogen Products - Hydrogen Studies</title>
        <meta name="description" content="Hydrogen water bottles, machines, inhalation and bath devices from Echo Water, the company that funds Hydrogen Studies." />
        <meta property="og:title" content="Molecular Hydrogen Products - Hydrogen Studies" />
        <meta property="og:description" content="Hydrogen water bottles, machines, inhalation and bath devices from Echo Water, the company that funds Hydrogen Studies." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hydrogenstudies.com/products" />
        <link rel="canonical" href="https://hydrogenstudies.com/products" />
      </Helmet>
      {products.map((product) => (
        <JsonLd
          key={`schema-${product.id}`}
          type="Product"
          data={generateProductSchema({
            name: product.name,
            description: product.description,
            image: product.image,
            url: product.url,
            brand: "Echo Water",
          })}
        />
      ))}
      <BuyersGuideModal open={showGuideModal} onClose={() => setShowGuideModal(false)} />
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <PageBreadcrumb items={[
              { label: "Home", href: "/" },
              { label: "Products" },
            ]} />
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Interested In Molecular Hydrogen Products?
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                There are several ways to get molecular hydrogen into your body.
                Explore products for hydrogen-rich water, hydrogen bathing,
                hydrogen gas inhalation, skin absorption, and powdered drink mix supplements.
              </p>
              <p className="mt-4 text-sm text-gray-500 max-w-3xl mx-auto">
                <strong>From our sponsor:</strong> these products are made by Echo
                Water, whose parent company, Echo Technologies LLC, funds Hydrogen
                Studies. We don't rank them against other brands. Concentrations
                marked * are manufacturer-stated.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Benefits Section */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
              What Research Shows So Far
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {benefits.map((benefit) => (
                <Card key={benefit.title} className="text-center">
                  <CardContent className="p-6">
                    <div className="mx-auto mb-4 p-3 rounded-full bg-gray-50 w-fit">
                      {benefit.icon}
                    </div>
                    <h3 className="font-semibold mb-2">{benefit.title}</h3>
                    <p className="text-gray-600 text-sm">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Delivery Method Filter */}
          {activeFilter && (
            <div className="mb-8 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-500">Showing:</span>
              <Badge variant="secondary" className="capitalize">
                {activeFilter.replace("-", " ")}
              </Badge>
              <Link href="/products">
                <Button variant="ghost" size="sm" className="text-sm">
                  Show all products
                </Button>
              </Link>
            </div>
          )}

          {/* Products Grid */}
          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="hover:shadow-xl transition-shadow"
              >
                <CardHeader>
                  <div className="relative">
                    <div className="aspect-video bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                      <ProductImage src={product.image} alt={product.name} />
                    </div>
                    {product.badge && (
                      <Badge className="absolute top-2 right-2">
                        {product.badge}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl">{product.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    {product.description}
                  </CardDescription>

                  <ul className="space-y-2 mb-6">
                    {product.features.map((feature) => (
                      <li
                        key={feature}
                        className="text-sm text-gray-600 flex items-center"
                      >
                        <div className="w-1.5 h-1.5 bg-teal-500 rounded-full mr-2 flex-shrink-0"></div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-2xl font-bold text-gray-900">
                        {product.price}
                      </span>
                      {product.originalPrice && (
                        <span className="text-lg text-gray-500 line-through ml-2">
                          {product.originalPrice}
                        </span>
                      )}
                    </div>
                  </div>

                  <a
                    href={product.url}
                    target="_blank"
                    rel="sponsored noopener"
                    onClick={() => trackOutboundClick(product.url, "products-page")}
                  >
                    <Button className="w-full mb-2">
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      View Product Details
                    </Button>
                  </a>
                  <Link href={`/explore-by-delivery-method/${product.deliveryMethod}`}>
                    <Button variant="outline" className="w-full text-sm">
                      Research on {product.deliveryMethod.replace("-", " ")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Product Comparison Table */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
              Compare Products at a Glance
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-lg shadow-sm border">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-4 text-sm font-semibold text-gray-700">Feature</th>
                    {products.map((p) => (
                      <th key={p.id} className="text-center p-4 text-sm font-semibold text-gray-700 min-w-[140px]">
                        {p.name.split(" ").slice(0, 2).join(" ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-4 text-sm font-medium text-gray-600">Delivery Method</td>
                    {products.map((p) => (
                      <td key={p.id} className="text-center p-4 text-sm capitalize">
                        {p.deliveryMethod.replace("-", " ")}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b bg-gray-50/50">
                    <td className="p-4 text-sm font-medium text-gray-600">H2 Concentration</td>
                    {products.map((p) => (
                      <td key={p.id} className="text-center p-4 text-sm font-medium text-teal-700">
                        {p.h2Concentration}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 text-sm font-medium text-gray-600">Best For</td>
                    {products.map((p) => (
                      <td key={p.id} className="text-center p-4 text-sm">{p.bestFor}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Lead Magnet CTA */}
          <Card className="mb-16 border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50">
            <CardContent className="p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Not Sure Which Delivery Method Is Right for You?
                </h2>
                <p className="text-gray-600 mb-4">
                  Get our free Hydrogen Delivery Methods Comparison Guide — how drinking,
                  inhalation and bathing were used in studies, and how much research
                  exists for each.
                </p>
                <ul className="space-y-2 mb-6 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-500 flex-shrink-0" />
                    Side-by-side method comparison with research citations
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-500 flex-shrink-0" />
                    What is and isn&apos;t known for each method
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-500 flex-shrink-0" />
                    What to check before you buy any device
                  </li>
                </ul>
                <Button
                  className="bg-teal-600 hover:bg-teal-700"
                  size="lg"
                  onClick={() => setShowGuideModal(true)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Free Guide
                </Button>
              </div>
              <div className="hidden md:flex items-center justify-center w-48 h-48 bg-white rounded-2xl shadow-sm">
                <div className="text-center p-4">
                  <Droplets className="h-12 w-12 text-teal-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-gray-700">Delivery Methods</p>
                  <p className="text-xs text-gray-500">Comparison Guide</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA Section */}
          <Card className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold mb-4">Need Help Choosing?</h2>
              <p className="text-xl mb-8 opacity-90">
                Echo Water's team can answer product questions and help you
                choose a device for your needs and budget.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href={echoContactUrl}
                  target="_blank"
                  rel="sponsored noopener"
                  onClick={() => trackOutboundClick(echoContactUrl, "products-page")}
                >
                  <Button variant="secondary" size="lg">
                    Contact Echo Water
                  </Button>
                </a>
                <Button
                  variant="outline"
                  size="lg"
                  className="text-white border-white hover:bg-white hover:text-teal-600"
                  onClick={() => setShowGuideModal(true)}
                >
                  Download Buyer's Guide
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* FAQ Section */}
          <div className="mt-16 mb-16">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
              Frequently Asked Questions
            </h2>
            <div className="max-w-3xl mx-auto space-y-3">
              {faqs.map((faq, index) => (
                <div key={index} className="bg-white rounded-lg border shadow-sm">
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors rounded-lg"
                  >
                    <span className="font-medium text-gray-900 pr-4">{faq.question}</span>
                    {openFaq === index ? (
                      <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  {openFaq === index && (
                    <div className="px-5 pb-5">
                      <p className="text-gray-600 text-sm leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-12 p-6 bg-gray-100 rounded-lg">
            <p className="text-sm text-gray-600 text-center">
              <strong>Disclaimer:</strong> These statements have not been
              evaluated by the FDA. These products are not intended to diagnose,
              treat, cure, or prevent any disease. Individual results may vary.
              Consult your healthcare provider before use.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
