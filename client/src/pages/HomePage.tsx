import { useState } from 'react';
import { Link } from 'wouter';
import { Helmet } from 'react-helmet';
import { Search, Droplets, Heart, Brain, Shield, Zap, Users, Award, ChevronRight, Play, Menu, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const benefits = [
    {
      icon: <Heart className="h-8 w-8 text-red-500" />,
      title: "Heart Health",
      description: "Studies show hydrogen water may support cardiovascular function and reduce oxidative stress on heart tissue.",
      studyCount: "47 studies"
    },
    {
      icon: <Brain className="h-8 w-8 text-blue-500" />,
      title: "Brain Function", 
      description: "Research indicates potential cognitive benefits and neuroprotective effects from molecular hydrogen.",
      studyCount: "32 studies"
    },
    {
      icon: <Shield className="h-8 w-8 text-green-500" />,
      title: "Antioxidant Power",
      description: "Hydrogen acts as a selective antioxidant, targeting harmful free radicals while preserving beneficial ones.",
      studyCount: "89 studies"
    },
    {
      icon: <Zap className="h-8 w-8 text-yellow-500" />,
      title: "Energy & Recovery",
      description: "Athletes report improved performance and faster recovery times with hydrogen water supplementation.",
      studyCount: "23 studies"
    }
  ];

  const stats = [
    { number: "1,304", label: "Scientific Studies" },
    { number: "25+", label: "Countries Researching" },
    { number: "500+", label: "Published Papers" },
    { number: "15+", label: "Years of Research" }
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Droplets className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Hydrogen Studies</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {/* Studies Dropdown */}
              <div className="relative group">
                <button className="text-gray-700 hover:text-blue-600 transition-colors flex items-center space-x-1">
                  <span>Studies</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="p-2 space-y-1">
                    <Link href="/studies" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                      All Studies
                    </Link>
                    <Link href="/recent-studies" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                      Recent Studies
                    </Link>
                    <Link href="/explore-by-condition" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                      By Health Condition
                    </Link>
                    <Link href="/explore-by-body-system" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                      By Body System
                    </Link>
                    <Link href="/explore-by-life-stage" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                      By Life Stage
                    </Link>
                    <Link href="/explore-by-delivery-method" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                      By Delivery Method
                    </Link>
                    <Link href="/explore-by-benefit" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                      By Health Benefit
                    </Link>
                    <Link href="/insights" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                      Research Insights
                    </Link>
                  </div>
                </div>
              </div>
              
              <Link href="/blog" className="text-gray-700 hover:text-blue-600 transition-colors">
                Blog
              </Link>
              <Link href="/benefits" className="text-gray-700 hover:text-blue-600 transition-colors">
                Benefits
              </Link>
              <Link href="/research-analytics" className="text-gray-700 hover:text-blue-600 transition-colors">
                Analytics  
              </Link>
              <Link href="/products" className="text-gray-700 hover:text-blue-600 transition-colors">
                Products
              </Link>
              <Link href="/chat" className="text-gray-700 hover:text-blue-600 transition-colors">
                AI Assistant
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden absolute top-full left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
              <div className="px-4 py-3 space-y-2">
                {/* Studies Section */}
                <div className="border-b pb-2 mb-2">
                  <div className="px-4 py-2 text-sm font-semibold text-gray-600 uppercase tracking-wide">
                    Studies
                  </div>
                  <Link href="/studies">
                    <div 
                      className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      All Studies
                    </div>
                  </Link>
                  <Link href="/recent-studies">
                    <div 
                      className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Recent Studies
                    </div>
                  </Link>
                  <Link href="/explore-by-condition">
                    <div 
                      className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      By Health Condition
                    </div>
                  </Link>
                  <Link href="/explore-by-body-system">
                    <div 
                      className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      By Body System
                    </div>
                  </Link>
                  <Link href="/explore-by-life-stage">
                    <div 
                      className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      By Life Stage
                    </div>
                  </Link>
                  <Link href="/explore-by-delivery-method">
                    <div 
                      className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      By Delivery Method
                    </div>
                  </Link>
                  <Link href="/explore-by-benefit">
                    <div 
                      className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      By Health Benefit
                    </div>
                  </Link>
                  <Link href="/insights">
                    <div 
                      className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Research Insights
                    </div>
                  </Link>
                </div>
                
                <Link href="/blog">
                  <div 
                    className="block px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Blog
                  </div>
                </Link>
                <Link href="/benefits">
                  <div 
                    className="block px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Benefits
                  </div>
                </Link>
                <Link href="/research-analytics">
                  <div 
                    className="block px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Analytics
                  </div>
                </Link>
                <Link href="/products">
                  <div 
                    className="block px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Products
                  </div>
                </Link>
                <Link href="/chat">
                  <div 
                    className="block px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    AI Assistant
                  </div>
                </Link>

              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Discover the Science Behind
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600 block">
                Hydrogen Water
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Explore 1,304+ peer-reviewed studies from leading universities worldwide. 
              Learn how molecular hydrogen could transform your health and wellness journey.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  type="text"
                  placeholder="Search studies by condition, benefit, or keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-4 py-4 text-lg rounded-full border-2 border-gray-200 focus:border-blue-500 shadow-lg"
                />
                <Button 
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 rounded-full px-8"
                >
                  Search
                </Button>
              </div>
            </form>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <Badge variant="secondary" className="px-4 py-2">
                <Play className="h-4 w-4 mr-2" />
                Watch: How It Works
              </Badge>
              <Badge variant="outline" className="px-4 py-2">
                <Users className="h-4 w-4 mr-2" />
                Join 50K+ Health Enthusiasts
              </Badge>
              <Badge variant="outline" className="px-4 py-2">
                <Award className="h-4 w-4 mr-2" />
                Backed by Science
              </Badge>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
            {stats.map((stat, index) => (
              <Card key={index} className="text-center border-none shadow-lg bg-white/70 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="text-3xl font-bold text-blue-600 mb-2">{stat.number}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Science-Backed Health Benefits
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover what thousands of peer-reviewed studies reveal about hydrogen water's 
              potential to support your health and wellness goals.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {benefits.map((benefit, index) => {
              type BenefitTitle = "Heart Health" | "Brain Function" | "Antioxidant Power" | "Energy & Recovery";
              
              const searchQueries: Record<BenefitTitle, string> = {
                "Heart Health": "cardiovascular heart cardiac hypertension blood pressure",
                "Brain Function": "neurological cognitive brain neuroprotective memory",
                "Antioxidant Power": "antioxidant oxidative stress free radicals ROS",
                "Energy & Recovery": "athletic performance exercise recovery fatigue energy"
              };

              const detailedBenefits: Record<BenefitTitle, string[]> = {
                "Heart Health": [
                  'May reduce blood pressure in hypertensive individuals',
                  'Potential improvement in arterial flexibility',
                  'Reduction in markers of cardiovascular inflammation',
                  'Support for healthy cholesterol levels'
                ],
                "Brain Function": [
                  'May improve cognitive function in elderly adults',
                  'Potential neuroprotective effects against oxidative damage',
                  'Support for mental clarity and focus',
                  'Possible benefits for neurodegenerative conditions'
                ],
                "Antioxidant Power": [
                  'Selective neutralization of hydroxyl radicals',
                  'Reduction in oxidative stress markers',
                  'Support for cellular protection',
                  'May help reduce inflammation'
                ],
                "Energy & Recovery": [
                  'Reduced exercise-induced fatigue',
                  'Faster recovery between training sessions',
                  'Decreased muscle damage markers',
                  'Improved endurance capacity'
                ]
              };

              const benefitTitle = benefit.title as BenefitTitle;
              return (
                <Link key={index} href={`/search?q=${encodeURIComponent(searchQueries[benefitTitle] || '')}`} className="block h-full">
                  <Card className="group hover:shadow-xl transition-all duration-300 border-none bg-gradient-to-br from-white to-gray-50 h-full cursor-pointer hover:scale-105">
                    <CardHeader className="text-center pb-4">
                      <div className="mx-auto mb-4 p-3 rounded-full bg-gray-50 group-hover:bg-white transition-colors">
                        {benefit.icon}
                      </div>
                      <CardTitle className="text-xl mb-2 group-hover:text-blue-600 transition-colors">{benefit.title}</CardTitle>
                      <Badge variant="secondary" className="mx-auto group-hover:bg-blue-100 group-hover:text-blue-700">
                        {benefit.studyCount}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-center text-gray-600 leading-relaxed mb-4">
                        {benefit.description}
                      </CardDescription>

                      {/* Detailed Benefits List */}
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 text-center">Potential Benefits</h4>
                        <ul className="space-y-2">
                          {(detailedBenefits[benefitTitle] || []).map((benefitItem: string, benefitIndex: number) => (
                            <li key={benefitIndex} className="flex items-start gap-2 text-sm text-gray-600">
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                              <span>{benefitItem}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Click to explore indicator */}
                      <div className="text-center pt-2">
                        <Badge variant="outline" className="group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          Click to explore studies
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          <div className="text-center">
            <Link href="/benefits">
              <Button size="lg" className="rounded-full px-8">
                Explore All Benefits
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Research Credibility */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Trusted by Leading Research Institutions
          </h2>
          <p className="text-xl mb-12 opacity-90 max-w-3xl mx-auto">
            Our database includes studies from Harvard, Mayo Clinic, Tokyo Medical University, 
            and hundreds of other prestigious institutions worldwide.
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
              <CardContent className="p-8 text-center">
                <div className="text-3xl font-bold mb-2">25+</div>
                <div className="text-lg opacity-90">Countries</div>
                <div className="text-sm opacity-70 mt-2">Conducting hydrogen research</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
              <CardContent className="p-8 text-center">
                <div className="text-3xl font-bold mb-2">500+</div>
                <div className="text-lg opacity-90">Universities</div>
                <div className="text-sm opacity-70 mt-2">Publishing hydrogen studies</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
              <CardContent className="p-8 text-center">
                <div className="text-3xl font-bold mb-2">98%</div>
                <div className="text-lg opacity-90">Peer-Reviewed</div>
                <div className="text-sm opacity-70 mt-2">Studies in our database</div>
              </CardContent>
            </Card>
          </div>

          <Link href="/research">
            <Button variant="secondary" size="lg" className="rounded-full px-8">
              Browse Research Database
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Ready to Experience the Science?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands who are already discovering the potential of hydrogen water. 
            Start with our research-backed product recommendations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/products">
              <Button size="lg" className="rounded-full px-8">
                View Products
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/blog">
              <Button variant="outline" size="lg" className="rounded-full px-8">
                Read Success Stories
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Droplets className="h-6 w-6 text-blue-400" />
                <span className="text-lg font-bold">HydrogenHealth</span>
              </div>
              <p className="text-gray-400 text-sm">
                Your trusted source for hydrogen water research and education.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Research</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/research" className="hover:text-white transition-colors">Browse Studies</Link></li>

                <li><Link href="/categories" className="hover:text-white transition-colors">By Category</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Learn</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/benefits" className="hover:text-white transition-colors">Health Benefits</Link></li>
                <li><Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Products</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/products" className="hover:text-white transition-colors">Recommendations</Link></li>
                <li><Link href="/reviews" className="hover:text-white transition-colors">Reviews</Link></li>
                <li><Link href="/buying-guide" className="hover:text-white transition-colors">Buying Guide</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 HydrogenHealth. All rights reserved. | Based on {stats[0].number} peer-reviewed studies</p>
          </div>
        </div>
      </footer>
    </div>
  );
}