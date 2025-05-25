import React from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Calendar, User, Tag, Clock, TrendingUp, ChevronRight, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function BlogListPage() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('all');

  // Fetch blog articles from your database
  const { data: articles, isLoading } = useQuery({
    queryKey: ['/api/blog/articles'],
  });

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'research-insights', label: 'Research Insights' },
    { value: 'health-benefits', label: 'Health Benefits' },
    { value: 'product-applications', label: 'Product Applications' },
    { value: 'company-news', label: 'Company News' },
    { value: 'expert-interviews', label: 'Expert Interviews' },
    { value: 'case-studies', label: 'Case Studies' }
  ];

  const featuredArticles = [
    {
      id: 1,
      title: 'Top 5 Hydrogen Studies on Gut Health: What the Research Shows',
      summary: 'A comprehensive analysis of the latest research on hydrogen therapy for digestive health and gut microbiome support.',
      author: 'Dr. Sarah Chen',
      publishDate: '2024-01-15',
      readTime: '8 min read',
      category: 'Research Insights',
      imageUrl: 'https://placehold.co/600x300/e2f3ff/003366?text=Gut+Health+Research',
      featured: true,
      tags: ['gut health', 'microbiome', 'research analysis']
    },
    {
      id: 2,
      title: 'How Athletes Are Using Hydrogen Water for Performance Enhancement',
      summary: 'Exploring the growing trend of hydrogen water in professional sports and what the science says about its benefits.',
      author: 'Mike Rodriguez',
      publishDate: '2024-01-12',
      readTime: '6 min read',
      category: 'Product Applications',
      imageUrl: 'https://placehold.co/600x300/e2f3ff/003366?text=Athletic+Performance',
      featured: true,
      tags: ['athletics', 'performance', 'hydrogen water']
    },
    {
      id: 3,
      title: 'Understanding Hydrogen Inhalation Therapy: A Beginner\'s Guide',
      summary: 'Everything you need to know about hydrogen inhalation therapy, from mechanisms to practical applications.',
      author: 'Dr. James Wilson',
      publishDate: '2024-01-10',
      readTime: '10 min read',
      category: 'Health Benefits',
      imageUrl: 'https://placehold.co/600x300/e2f3ff/003366?text=Inhalation+Therapy',
      featured: false,
      tags: ['inhalation therapy', 'beginners guide', 'health benefits']
    }
  ];

  const filteredArticles = featuredArticles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.summary.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
                           article.category.toLowerCase().replace(' ', '-') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <TrendingUp className="h-16 w-16 text-blue-600 mx-auto mb-6" />
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Research
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {" "}Blog
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Insights, analysis, and the latest developments in hydrogen health research
          </p>
          <Badge className="bg-blue-100 text-blue-800 px-4 py-2">
            Editorial content by experts and researchers
          </Badge>
        </div>
      </section>

      {/* Search and Filter */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 bg-white border-y">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-4">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Article */}
      {filteredArticles.find(article => article.featured) && (
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Featured Article</h2>
            {filteredArticles
              .filter(article => article.featured)
              .slice(0, 1)
              .map((article) => (
                <Link key={article.id} href={`/blog/${article.id}`}>
                  <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden">
                    <div className="md:flex">
                      <div className="md:w-1/2">
                        <img
                          src={article.imageUrl}
                          alt={article.title}
                          className="w-full h-64 md:h-full object-cover"
                        />
                      </div>
                      <div className="md:w-1/2 p-8">
                        <div className="flex items-center space-x-4 mb-4">
                          <Badge className="bg-blue-100 text-blue-800">{article.category}</Badge>
                          <Badge variant="outline">Featured</Badge>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-4 line-clamp-2">
                          {article.title}
                        </h3>
                        <p className="text-gray-600 mb-6 line-clamp-3">
                          {article.summary}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              {article.author}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              {formatDate(article.publishDate)}
                            </div>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {article.readTime}
                            </div>
                          </div>
                          <div className="flex items-center text-blue-600 font-medium">
                            Read more <ChevronRight className="h-4 w-4 ml-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
          </div>
        </section>
      )}

      {/* Article Grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Latest Articles</h2>
            <p className="text-gray-600">{filteredArticles.length} articles found</p>
          </div>

          {filteredArticles.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No articles found</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredArticles
                .filter(article => !article.featured)
                .map((article) => (
                  <Link key={article.id} href={`/blog/${article.id}`}>
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                      <div className="aspect-video">
                        <img
                          src={article.imageUrl}
                          alt={article.title}
                          className="w-full h-full object-cover rounded-t-lg"
                        />
                      </div>
                      <CardHeader>
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary">{article.category}</Badge>
                          <span className="text-sm text-gray-500">{article.readTime}</span>
                        </div>
                        <CardTitle className="text-lg line-clamp-2">{article.title}</CardTitle>
                        <CardDescription className="line-clamp-2">{article.summary}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                          <div className="flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            {article.author}
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(article.publishDate)}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {article.tags.slice(0, 2).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {article.tags.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{article.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
            </div>
          )}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-blue-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Stay Updated</h2>
          <p className="text-lg text-gray-600 mb-8">
            Get the latest hydrogen research insights delivered to your inbox
          </p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <Input type="email" placeholder="Enter your email" className="flex-1" />
            <Button className="bg-blue-600 hover:bg-blue-700">Subscribe</Button>
          </div>
        </div>
      </section>
    </div>
  );
}