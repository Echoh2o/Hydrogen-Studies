import { useState } from 'react';
import { Link } from 'wouter';
import { Search, Droplets, Heart, Brain, Shield, Zap, Users, Award, ChevronRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Droplets className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">HydrogenHealth</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/blog" className="text-gray-700 hover:text-blue-600 transition-colors">
                Blog
              </Link>
              <Link href="/research" className="text-gray-700 hover:text-blue-600 transition-colors">
                Research
              </Link>
              <Link href="/benefits" className="text-gray-700 hover:text-blue-600 transition-colors">
                Benefits
              </Link>
              <Link href="/products" className="text-gray-700 hover:text-blue-600 transition-colors">
                Products
              </Link>
              <Button variant="outline" size="sm">
                Advanced Search
              </Button>
            </div>
          </div>
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
            {benefits.map((benefit, index) => (
              <Card key={index} className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-none bg-gradient-to-br from-white to-gray-50">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-3 rounded-full bg-gray-50 group-hover:bg-white transition-colors">
                    {benefit.icon}
                  </div>
                  <CardTitle className="text-xl mb-2">{benefit.title}</CardTitle>
                  <Badge variant="secondary" className="mx-auto">
                    {benefit.studyCount}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center text-gray-600 leading-relaxed">
                    {benefit.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
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
                <li><Link href="/advanced-search" className="hover:text-white transition-colors">Advanced Search</Link></li>
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