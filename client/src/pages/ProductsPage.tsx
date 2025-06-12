import { Link } from 'wouter';
import { ArrowLeft, Star, ShoppingCart, Award, Droplets, Heart, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ProductsPage() {
  const products = [
    {
      id: 1,
      name: "HydroMax Pro Generator",
      price: "$299",
      originalPrice: "$399",
      rating: 4.8,
      reviews: 324,
      description: "Professional-grade hydrogen water generator with titanium plates and advanced electrolysis technology.",
      features: ["1.5 PPM H2 concentration", "Self-cleaning function", "BPA-free materials", "2-year warranty"],
      image: "/images/hydromax-pro.jpg",
      badge: "Best Seller"
    },
    {
      id: 2,
      name: "H2 Wellness Bottle",
      price: "$149",
      originalPrice: "$199",
      rating: 4.6,
      reviews: 186,
      description: "Portable hydrogen water bottle perfect for daily use and travel.",
      features: ["0.8-1.2 PPM H2", "USB rechargeable", "Medical-grade materials", "Easy one-touch operation"],
      image: "/images/h2-wellness.jpg",
      badge: "Portable"
    },
    {
      id: 3,
      name: "AquaLife Home System",
      price: "$599",
      originalPrice: "$799",
      rating: 4.9,
      reviews: 97,
      description: "Complete home hydrogen water system with advanced filtration and mineralization.",
      features: ["2.0+ PPM H2 concentration", "Multi-stage filtration", "Smart app control", "Professional installation"],
      image: "/images/aqualife-home.jpg",
      badge: "Premium"
    }
  ];

  const benefits = [
    {
      icon: <Heart className="h-6 w-6 text-red-500" />,
      title: "Heart Health Support",
      description: "Studies show potential cardiovascular benefits"
    },
    {
      icon: <Zap className="h-6 w-6 text-yellow-500" />,
      title: "Energy & Recovery",
      description: "May improve athletic performance and recovery"
    },
    {
      icon: <Award className="h-6 w-6 text-blue-500" />,
      title: "Antioxidant Properties",
      description: "Selective antioxidant targeting harmful free radicals"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/" className="flex items-center text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Research-Backed Hydrogen Water Products
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Carefully selected products based on scientific studies and quality standards. 
              Each recommendation is backed by our research database of 1,304+ studies.
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
            {benefits.map((benefit, index) => (
              <Card key={index} className="text-center">
                <CardContent className="p-6">
                  <div className="mx-auto mb-4 p-3 rounded-full bg-gray-50 w-fit">
                    {benefit.icon}
                  </div>
                  <h3 className="font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-gray-600 text-sm">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {products.map((product) => (
            <Card key={product.id} className="hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="relative">
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-cyan-100 rounded-lg mb-4 flex items-center justify-center">
                    <Droplets className="h-16 w-16 text-blue-500" />
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
                    <span className="text-sm font-medium ml-1">{product.rating}</span>
                  </div>
                  <span className="text-sm text-gray-500">({product.reviews} reviews)</span>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  {product.description}
                </CardDescription>
                
                <ul className="space-y-2 mb-6">
                  {product.features.map((feature, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-center">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 flex-shrink-0"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-2xl font-bold text-gray-900">{product.price}</span>
                    {product.originalPrice && (
                      <span className="text-lg text-gray-500 line-through ml-2">
                        {product.originalPrice}
                      </span>
                    )}
                  </div>
                </div>
                
                <Button className="w-full mb-2">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  View Product Details
                </Button>
                <Button variant="outline" className="w-full text-sm">
                  Read Scientific Studies
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Need Help Choosing?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Our experts can help you find the perfect hydrogen water solution based on your needs and budget.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="secondary" size="lg">
                Free Consultation
              </Button>
              <Button variant="outline" size="lg" className="text-white border-white hover:bg-white hover:text-blue-600">
                Download Buyer's Guide
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <div className="mt-12 p-6 bg-gray-100 rounded-lg">
          <p className="text-sm text-gray-600 text-center">
            <strong>Disclaimer:</strong> These statements have not been evaluated by the FDA. 
            These products are not intended to diagnose, treat, cure, or prevent any disease. 
            Individual results may vary. Consult your healthcare provider before use.
          </p>
        </div>
      </div>
    </div>
  );
}