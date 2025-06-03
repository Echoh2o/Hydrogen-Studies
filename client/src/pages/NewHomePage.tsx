import React from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Search, MessageCircle, TrendingUp, Users, Award, ChevronRight, Sparkles, Tag, Database, Heart, Clock, Calendar, Star, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function NewHomePage() {
  const [searchQuery, setSearchQuery] = React.useState('');

  // Get trending topics from our automated tagging system
  const { data: trendingData } = useQuery({
    queryKey: ["/api/search/trending"],
  });

  // Get consumer-friendly categories with real counts
  const { data: consumerCategories } = useQuery({
    queryKey: ["/api/consumer-categories/counts"],
  });

  // Get recent studies with tags
  const { data: recentStudiesData } = useQuery({
    queryKey: ["/api/search/enhanced", { sortBy: 'date', limit: 6 }],
  });

  // Featured health conditions from actual database
  const featuredConditions = (consumerCategories as any)?.data?.condition?.slice(0, 4) || [];
  
  // Featured body systems from actual database  
  const featuredBodySystems = (consumerCategories as any)?.data?.body_system?.slice(0, 4) || [];
  
  // Featured life stages from actual database
  const featuredLifeStages = (consumerCategories as any)?.data?.life_stage || [];

  const recentStudies = [
    {
      id: 1326,
      title: 'Molecular hydrogen inhalation ameliorates aspirin-induced gastric mucosal injury in rats',
      journal: 'Journal of Clinical Medicine',
      year: '2024',
      category: 'Gastrointestinal'
    },
    {
      id: 1325,
      title: 'Effects of hydrogen-rich water on exercise-induced oxidative stress',
      journal: 'Free Radical Biology and Medicine',
      year: '2024',
      category: 'Fitness'
    },
    {
      id: 1324,
      title: 'Hydrogen therapy for neurodegenerative diseases: A systematic review',
      journal: 'Frontiers in Neurology',
      year: '2024',
      category: 'Neurological'
    }
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Understand the
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {" "}Science of Hydrogen{" "}
            </span>
            for Health
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Explore the world's most comprehensive database of peer-reviewed hydrogen health research. 
            Discover 1,326+ studies backed by scientific evidence.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-12">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="Search studies by condition, benefit, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-24 py-4 text-lg border-2 border-gray-200 focus:border-blue-500 rounded-xl shadow-lg"
              />
              <Button 
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700"
              >
                Search
              </Button>
            </div>
          </form>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">1,326+</div>
              <div className="text-gray-600">Peer-Reviewed Studies</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">50+</div>
              <div className="text-gray-600">Health Conditions</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">96%</div>
              <div className="text-gray-600">Studies with DOI Links</div>
            </div>
          </div>
        </div>
      </section>

      {/* Research Exploration Hub */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Explore 1,326+ Hydrogen Health Studies
            </h2>
            <p className="text-lg text-gray-600">
              Discover research organized by health conditions, body systems, and life stages
            </p>
          </div>

          {/* Three-Section Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Health Conditions */}
            <div className="space-y-4">
              <div className="text-center">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Health Conditions</h3>
                <p className="text-gray-600 mb-6">Research by specific health concerns</p>
              </div>
              
              <div className="space-y-3">
                {featuredConditions.slice(0, 4).map((condition: any) => (
                  <Link key={condition.name} href="/explore-by-condition">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer border hover:border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{condition.name}</span>
                          <Badge variant="secondary">{condition.count}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
              
              <Link href="/explore-by-condition">
                <Button variant="outline" className="w-full mt-4">
                  View All Conditions <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>

            {/* Body Systems */}
            <div className="space-y-4">
              <div className="text-center">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Body Systems</h3>
                <p className="text-gray-600 mb-6">Research by anatomical systems</p>
              </div>
              
              <div className="space-y-3">
                {featuredBodySystems.slice(0, 4).map((system: any) => (
                  <Link key={system.name} href="/explore-by-body-system">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer border hover:border-green-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{system.name}</span>
                          <Badge variant="secondary">{system.count}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
              
              <Link href="/explore-by-body-system">
                <Button variant="outline" className="w-full mt-4">
                  View All Systems <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>

            {/* Life Stages */}
            <div className="space-y-4">
              <div className="text-center">
                <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Life Stages</h3>
                <p className="text-gray-600 mb-6">Research by age and demographics</p>
              </div>
              
              <div className="space-y-3">
                {featuredLifeStages.map((stage: any) => (
                  <Link key={stage.name} href="/explore-by-life-stage">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer border hover:border-purple-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{stage.name}</span>
                          <Badge variant="secondary">{stage.count}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
              
              <Link href="/explore-by-life-stage">
                <Button variant="outline" className="w-full mt-4">
                  View All Life Stages <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Quick Access Bar */}
          <div className="mt-12 p-6 bg-gray-50 rounded-xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/search?sortBy=date">
                <Button variant="ghost" className="h-auto p-4 flex flex-col items-center space-y-2">
                  <Calendar className="h-6 w-6 text-blue-600" />
                  <span className="text-sm font-medium">Latest Studies</span>
                </Button>
              </Link>
              
              <Link href="/search?sortBy=citations">
                <Button variant="ghost" className="h-auto p-4 flex flex-col items-center space-y-2">
                  <Star className="h-6 w-6 text-yellow-600" />
                  <span className="text-sm font-medium">Most Cited</span>
                </Button>
              </Link>
              
              <Link href="/studies/tags">
                <Button variant="ghost" className="h-auto p-4 flex flex-col items-center space-y-2">
                  <BookOpen className="h-6 w-6 text-green-600" />
                  <span className="text-sm font-medium">Browse by Tags</span>
                </Button>
              </Link>
              
              <Link href="/insights">
                <Button variant="ghost" className="h-auto p-4 flex flex-col items-center space-y-2">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                  <span className="text-sm font-medium">Research Trends</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* AI Chatbot Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-blue-50">
        <div className="max-w-4xl mx-auto text-center">
          <MessageCircle className="h-12 w-12 text-blue-600 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ask Our AI Research Assistant
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Get instant answers about hydrogen research, study interpretations, and health applications
          </p>
          <Link href="/chat">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 px-8 py-3">
              Start Conversation
            </Button>
          </Link>
        </div>
      </section>

      {/* Recent Studies */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Latest Research</h2>
            <Link href="/search">
              <Button variant="outline" className="flex items-center">
                View All Studies <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recentStudies.map((study) => (
              <Link key={study.id} href={`/study/${study.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary">{study.category}</Badge>
                      <span className="text-sm text-gray-500">{study.year}</span>
                    </div>
                    <CardTitle className="text-lg line-clamp-2">{study.title}</CardTitle>
                    <CardDescription>{study.journal}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Study Visualization Teaser */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <TrendingUp className="h-12 w-12 text-green-600 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Research Insights & Trends
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Visualize research patterns, health outcomes, and scientific progress in hydrogen therapy
          </p>
          <Link href="/insights">
            <Button size="lg" variant="outline" className="px-8 py-3">
              Explore Visualizations
            </Button>
          </Link>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Trusted by Researchers & Health Professionals
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <Award className="h-8 w-8 text-yellow-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Peer-Reviewed Sources</h3>
              <p className="text-gray-600">All studies sourced from reputable scientific journals</p>
            </div>
            <div>
              <Users className="h-8 w-8 text-blue-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Expert Curation</h3>
              <p className="text-gray-600">Research vetted by healthcare and scientific professionals</p>
            </div>
            <div>
              <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Regular Updates</h3>
              <p className="text-gray-600">Database continuously updated with latest research</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}