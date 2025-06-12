import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Search, Filter, Calendar, MapPin, FileText, Users, Award, ChevronDown, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link } from 'wouter';

interface Study {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publish_year: number;
  category: string;
  country: string;
  study_type: string;
  sample_size: number;
  citation_count: number;
  peer_reviewed: boolean;
  has_full_text: boolean;
  image_url: string;
  doi: string;
  plain_language_title: string;
}

export default function SearchPage() {
  const [location] = useLocation();
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('');
  const [country, setCountry] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const q = params.get('q') || '';
    setSearchQuery(q);
    if (q) {
      performSearch(q);
    }
  }, [location]);

  const performSearch = async (query: string, filters: any = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: query,
        category: filters.category || category,
        country: filters.country || country,
        limit: '20'
      });
      
      const response = await fetch(`/api/advanced-search?${params}`);
      const data = await response.json();
      
      setStudies(data.studies || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Search error:', error);
    }
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery, { category, country });
  };

  const handleFilterChange = () => {
    performSearch(searchQuery, { category, country });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="flex items-center text-blue-600 hover:text-blue-700">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
            <Badge variant="secondary" className="px-3 py-1">
              {total.toLocaleString()} studies found
            </Badge>
          </div>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search studies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleContent className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Filter Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Category</label>
                    <Select value={category} onValueChange={(value) => {
                      setCategory(value);
                      setTimeout(handleFilterChange, 100);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All categories</SelectItem>
                        <SelectItem value="cardiovascular">Cardiovascular</SelectItem>
                        <SelectItem value="diabetes">Diabetes</SelectItem>
                        <SelectItem value="neurological">Neurological</SelectItem>
                        <SelectItem value="cancer">Cancer</SelectItem>
                        <SelectItem value="kidney">Kidney</SelectItem>
                        <SelectItem value="exercise">Exercise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Country</label>
                    <Select value={country} onValueChange={(value) => {
                      setCountry(value);
                      setTimeout(handleFilterChange, 100);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All countries" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All countries</SelectItem>
                        <SelectItem value="Japan">Japan</SelectItem>
                        <SelectItem value="China">China</SelectItem>
                        <SelectItem value="United States">United States</SelectItem>
                        <SelectItem value="South Korea">South Korea</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-end">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setCategory('');
                        setCountry('');
                        setTimeout(() => performSearch(searchQuery), 100);
                      }}
                      className="w-full"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Results */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Searching studies...</p>
          </div>
        ) : studies.length > 0 ? (
          <div className="space-y-6">
            {studies.map((study) => (
              <Card key={study.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
                        {study.plain_language_title || study.title}
                      </h3>
                      <p className="text-gray-600 mb-3 line-clamp-3">
                        {study.abstract}
                      </p>
                    </div>
                    {study.image_url && (
                      <img 
                        src={study.image_url} 
                        alt="Study illustration"
                        className="w-24 h-24 object-cover rounded-lg ml-4 flex-shrink-0"
                      />
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {study.publish_year}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {study.country}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {study.sample_size} participants
                    </Badge>
                    {study.peer_reviewed && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Award className="h-3 w-3" />
                        Peer Reviewed
                      </Badge>
                    )}
                    {study.has_full_text && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Full Text
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <div>
                      <strong>Journal:</strong> {study.journal}
                    </div>
                    <div className="flex items-center gap-4">
                      <span><strong>Citations:</strong> {study.citation_count}</span>
                      <span><strong>Category:</strong> {study.category}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Load More Button */}
            <div className="text-center py-8">
              <Button variant="outline" size="lg">
                Load More Studies
              </Button>
            </div>
          </div>
        ) : searchQuery ? (
          <div className="text-center py-12">
            <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No studies found</h3>
            <p className="text-gray-600 mb-4">
              Try adjusting your search terms or filters to find relevant studies.
            </p>
            <Button onClick={() => {
              setSearchQuery('');
              setCategory('');
              setCountry('');
              performSearch('');
            }}>
              Browse All Studies
            </Button>
          </div>
        ) : (
          <div className="text-center py-12">
            <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Your Search</h3>
            <p className="text-gray-600">
              Enter keywords above to explore our database of 1,304+ hydrogen research studies.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}