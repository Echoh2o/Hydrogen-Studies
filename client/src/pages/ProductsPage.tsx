import { useState } from "react";
import { Link, useLocation } from "wouter";
import PageBreadcrumb from "@/components/seo/PageBreadcrumb";
import {
  ArrowLeft,
  Star,
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
  Quote,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Helmet } from "react-helmet";
import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import JsonLd, { generateProductSchema } from "@/components/seo/JsonLd";

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {status === "success" ? (
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-teal-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Check Your Inbox!</h3>
            <p className="text-gray-600 mb-4">
              Your Hydrogen Delivery Methods Comparison Guide is on its way.
            </p>
            <Button onClick={onClose} className="bg-teal-600 hover:bg-teal-700">
              Continue Browsing
            </Button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 p-3 rounded-full bg-teal-50 w-fit">
                <Download className="h-8 w-8 text-teal-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">
                Free: Hydrogen Delivery Methods Guide
              </h3>
              <p className="text-gray-600 text-sm">
                Compare drinking, inhalation, and bathing methods side-by-side.
                Learn which delivery method is best for your health goals.
              </p>
            </div>
            <ul className="space-y-2 mb-6 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-500 flex-shrink-0" />
                Side-by-side comparison of all 3 delivery methods
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-500 flex-shrink-0" />
                Research-backed pros and cons for each
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-500 flex-shrink-0" />
                Personalized recommendation by health goal
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
      </div>
    </div>
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
      rating: 4.9,
      reviews: 256,
      description:
        "The Echo Flask: Smart hydrogen water bottle with up to 8 ppm hydrogen concentration. Track hydration, customize settings & fuel your cells. Safe & effective.",
      features: [
        "Up to 8 PPM H2 concentration",
        "Smart tracking technology",
        "Customizable settings",
        "Safe & effective design",
      ],
      image:
        "https://echowater.com/cdn/shop/files/echo-flask-hydrogen-water-bottle.png?v=1722526066&width=600",
      badge: "Hydrogen Water",
      url: "https://echowater.com/products/echo-flask",
      deliveryMethod: "drinking-water",
      h2Concentration: "Up to 8 PPM",
      bestFor: "Daily hydration, portability",
    },
    {
      id: 2,
      name: "Hydrogen Prebiotic Stick Pack (30-pack)",
      price: "Visit Store",
      originalPrice: null,
      rating: 4.7,
      reviews: 189,
      description:
        "Boost energy, clarity, and gut health with Echo Hydrogen Prebiotic Stick Packs — instant hydration + prebiotics in one convenient packet.",
      features: [
        "Instant hydrogen hydration",
        "Prebiotic formula",
        "Energy & clarity boost",
        "Gut health support",
      ],
      image:
        "https://echowater.com/cdn/shop/files/hydrogen-prebiotic-stick-pack.png?v=1722526066&width=600",
      badge: "Powdered Drink Mix",
      url: "https://echowater.com/products/hydrogen-prebiotic-stick-pack-30-pack",
      deliveryMethod: "drinking-water",
      h2Concentration: "Variable",
      bestFor: "Gut health, on-the-go use",
    },
    {
      id: 3,
      name: "Echo Ultimate\u2122 Hydrogen Water Machine",
      price: "Visit Store",
      originalPrice: null,
      rating: 4.9,
      reviews: 143,
      description:
        "Echo Ultimate Hydrogen Water Machine offers a versatile solution for your water needs, producing four types of water: hydrogen, alkaline, acidic, and filtered.",
      features: [
        "4 types of water",
        "Hydrogen + alkaline production",
        "Easy installation",
        "10-year warranty",
      ],
      image:
        "https://echowater.com/cdn/shop/files/echo-ultimate-hydrogen-water-machine.png?v=1722526066&width=600",
      badge: "Hydrogen Water",
      url: "https://echowater.com/products/echo-ultimate-hydrogen-water",
      deliveryMethod: "drinking-water",
      h2Concentration: "Up to 4.5 PPM",
      bestFor: "Whole-household, multiple water types",
    },
    {
      id: 4,
      name: "Echo Refresh Hydrogen Inhalation Machine",
      price: "Visit Store",
      originalPrice: null,
      rating: 4.8,
      reviews: 97,
      description:
        "The Echo Refresh enables you to inhale hydrogen gas directly. It goes from your lungs into your bloodstream in a matter of seconds.",
      features: [
        "Direct hydrogen inhalation",
        "Rapid bloodstream absorption",
        "Immediate positive effects",
        "Professional grade",
      ],
      image:
        "https://echowater.com/cdn/shop/files/echo-refresh-hydrogen-inhalation-machine.png?v=1722526066&width=600",
      badge: "Inhalation",
      url: "https://echowater.com/products/echo-refresh-hydrogen-inhalation-machine",
      deliveryMethod: "inhalation",
      h2Concentration: "2% H2 gas",
      bestFor: "Respiratory support, rapid absorption",
    },
    {
      id: 5,
      name: "Echo Revive Hydrogen Bath Water Machine",
      price: "Visit Store",
      originalPrice: null,
      rating: 4.6,
      reviews: 78,
      description:
        "Upgrade your bath routine with the Echo Revive. Enjoy the benefits of hydrogen-rich bath water through skin absorption.",
      features: [
        "Hydrogen-rich bath water",
        "Skin absorption delivery",
        "Improved skin health",
        "Muscle soreness relief",
      ],
      image:
        "https://echowater.com/cdn/shop/files/echo-revive-hydrogen-bath-machine.png?v=1722526066&width=600",
      badge: "Bathing",
      url: "https://echowater.com/products/echo-revive",
      deliveryMethod: "bathing",
      h2Concentration: "Up to 1.5 PPM",
      bestFor: "Skin health, muscle recovery, relaxation",
    },
  ];

  const filteredProducts = activeFilter
    ? products.filter((p) => p.deliveryMethod === activeFilter)
    : products;

  const benefits = [
    {
      icon: <Heart className="h-6 w-6 text-red-500" />,
      title: "Heart Health Support",
      description: "Studies show potential cardiovascular benefits",
    },
    {
      icon: <Zap className="h-6 w-6 text-yellow-500" />,
      title: "Energy & Recovery",
      description: "May improve athletic performance and recovery",
    },
    {
      icon: <Award className="h-6 w-6 text-teal-500" />,
      title: "Antioxidant Properties",
      description: "Selective antioxidant targeting harmful free radicals",
    },
  ];

  const testimonials = [
    {
      name: "Sarah M.",
      role: "Fitness Coach",
      quote: "After researching hydrogen water studies on this site, I got the Echo Flask. My recovery time between workouts has noticeably improved.",
      rating: 5,
      product: "Echo Flask",
    },
    {
      name: "Dr. James L.",
      role: "Naturopathic Physician",
      quote: "I recommend the Echo Ultimate to my patients. The research behind molecular hydrogen is compelling, and the quality of this machine is excellent.",
      rating: 5,
      product: "Echo Ultimate",
    },
    {
      name: "Maria K.",
      role: "Wellness Enthusiast",
      quote: "The Hydrogen Prebiotic Stick Packs are a game-changer for travel. I never miss my hydrogen intake now, even on the go.",
      rating: 5,
      product: "Prebiotic Stick Packs",
    },
  ];

  const faqs = [
    {
      question: "What is hydrogen water and how does it work?",
      answer: "Hydrogen water is regular water infused with dissolved molecular hydrogen (H2) gas. Research suggests H2 acts as a selective antioxidant, targeting harmful hydroxyl radicals without disrupting beneficial reactive oxygen species. Hundreds of peer-reviewed studies have explored its potential health benefits.",
    },
    {
      question: "Which product is right for me?",
      answer: "It depends on your lifestyle and goals. The Echo Flask is perfect for portable daily hydration. The Echo Ultimate is ideal for families wanting unlimited hydrogen water at home. The Prebiotic Stick Packs are great for travel. The Echo Refresh is for those interested in hydrogen inhalation therapy, and the Echo Revive is for full-body hydrogen bath benefits.",
    },
    {
      question: "How does Echo Water compare to other hydrogen water brands?",
      answer: "Echo Water products consistently deliver higher H2 concentrations (up to 8 PPM with the Echo Flask) compared to most competitors. They use proprietary SPE/PEM electrolysis technology, and every product is backed by third-party testing. Echo Water also sponsors hydrogen research and is the only brand powering a dedicated research library.",
    },
    {
      question: "Is hydrogen water safe to drink?",
      answer: "Yes. Molecular hydrogen has an excellent safety profile with no known toxic effects at therapeutic concentrations. The FDA has recognized hydrogen gas as Generally Recognized as Safe (GRAS) for use in food. Hundreds of clinical studies have confirmed its safety in humans.",
    },
    {
      question: "How quickly will I notice benefits?",
      answer: "Individual experiences vary. Some users report increased energy and mental clarity within the first week. Athletic performance and recovery improvements are often noticed within 2-4 weeks. For chronic conditions studied in research, most clinical trials run 4-12 weeks. Consistent daily use is recommended.",
    },
    {
      question: "Do you offer a warranty or guarantee?",
      answer: "Echo Water offers industry-leading warranties: the Echo Ultimate comes with a 10-year warranty, and all products include a satisfaction guarantee. Visit echowater.com for full warranty details and their customer support team.",
    },
  ];

  return (
    <>
      <SiteHeader />
      <Helmet>
        <title>Molecular Hydrogen Products - Hydrogen Studies</title>
        <meta name="description" content="Carefully selected hydrogen water products backed by scientific research. Explore Echo Water hydrogen generators, bottles, and inhalation machines." />
        <meta property="og:title" content="Molecular Hydrogen Products - Hydrogen Studies" />
        <meta property="og:description" content="Carefully selected hydrogen water products backed by scientific research. Explore Echo Water hydrogen generators, bottles, and inhalation machines." />
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
            reviewCount: product.reviews,
            reviewRating: product.rating,
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
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Benefits Section */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
              Why Choose Hydrogen Water?
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
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-contain p-2"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.parentElement!.innerHTML = '<div class="flex items-center justify-center h-full"><svg class="h-16 w-16 text-teal-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg></div>';
                        }}
                      />
                    </div>
                    {product.badge && (
                      <Badge className="absolute top-2 right-2">
                        {product.badge}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl">{product.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="text-sm font-medium ml-1">
                        {product.rating}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      ({product.reviews} reviews)
                    </span>
                  </div>
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

                  <a href={product.url} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full mb-2">
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      View Product Details
                    </Button>
                  </a>
                  <Link href={`/search?q=${encodeURIComponent(product.name.split(" ").slice(0, 2).join(" "))}`}>
                    <Button variant="outline" className="w-full text-sm">
                      Read Scientific Studies
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
                  <tr className="border-b bg-gray-50/50">
                    <td className="p-4 text-sm font-medium text-gray-600">Rating</td>
                    {products.map((p) => (
                      <td key={p.id} className="text-center p-4">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="text-sm font-medium">{p.rating}</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 text-sm font-medium text-gray-600">Reviews</td>
                    {products.map((p) => (
                      <td key={p.id} className="text-center p-4 text-sm">{p.reviews}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Testimonials Section */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
              What Our Community Says
            </h2>
            <p className="text-center text-gray-500 mb-8">
              Real experiences from people who combined the research with the products
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <Card key={i} className="relative">
                  <CardContent className="p-6">
                    <Quote className="h-8 w-8 text-teal-100 absolute top-4 right-4" />
                    <div className="flex items-center gap-1 mb-3">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="h-4 w-4 text-yellow-400 fill-current" />
                      ))}
                    </div>
                    <p className="text-gray-700 text-sm mb-4 italic">"{t.quote}"</p>
                    <div className="border-t pt-3">
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.role}</p>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {t.product}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                  Get our free Hydrogen Delivery Methods Comparison Guide — a research-backed
                  breakdown of drinking, inhalation, and bathing methods to help you choose.
                </p>
                <ul className="space-y-2 mb-6 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-500 flex-shrink-0" />
                    Side-by-side method comparison with research citations
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-500 flex-shrink-0" />
                    Which method is best for your specific health goals
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-500 flex-shrink-0" />
                    Product recommendations based on the latest studies
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
                Our experts can help you find the perfect hydrogen water
                solution based on your needs and budget.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="https://echowater.com/pages/contact" target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="lg">
                    Free Consultation
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
