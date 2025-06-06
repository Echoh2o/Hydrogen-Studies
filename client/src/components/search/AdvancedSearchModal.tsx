/**
 * Advanced Search Modal with Multiple Filter Options
 * Provides comprehensive search and filtering capabilities
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HiFilter, HiX, HiSearch } from "react-icons/hi";
import { useQuery } from "@tanstack/react-query";

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

interface SearchFilters {
  query: string;
  categories: string[];
  authors: string[];
  journals: string[];
  yearRange: {
    start: number | null;
    end: number | null;
  };
  studyTypes: string[];
  hasFullText: boolean | null;
  hasDOI: boolean | null;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export const AdvancedSearchModal: React.FC<AdvancedSearchProps> = ({
  onSearch,
  isOpen,
  setIsOpen
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    categories: [],
    authors: [],
    journals: [],
    yearRange: { start: null, end: null },
    studyTypes: [],
    hasFullText: null,
    hasDOI: null,
    sortBy: 'relevance',
    sortOrder: 'desc'
  });

  // Fetch available filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['/api/search/filter-options'],
    enabled: isOpen
  });

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleArrayFilterToggle = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter(item => item !== value)
        : [...prev[key], value]
    }));
  };

  const handleSearch = () => {
    onSearch(filters);
    setIsOpen(false);
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      categories: [],
      authors: [],
      journals: [],
      yearRange: { start: null, end: null },
      studyTypes: [],
      hasFullText: null,
      hasDOI: null,
      sortBy: 'relevance',
      sortOrder: 'desc'
    });
  };

  const activeFiltersCount = Object.entries(filters).reduce((count, [key, value]) => {
    if (key === 'query' && value) return count + 1;
    if (Array.isArray(value) && value.length > 0) return count + value.length;
    if (key === 'yearRange' && (value.start || value.end)) return count + 1;
    if (typeof value === 'boolean' && value !== null) return count + 1;
    return count;
  }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <HiFilter className="h-4 w-4" />
          Advanced Search
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HiSearch className="h-5 w-5" />
            Advanced Search & Filters
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Search Query */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Search Query</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="search-query">Keywords or Phrases</Label>
                <Input
                  id="search-query"
                  placeholder="Enter search terms..."
                  value={filters.query}
                  onChange={(e) => handleFilterChange('query', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Health Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {filterOptions?.categories?.map((category: any) => (
                  <div key={category.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${category.id}`}
                      checked={filters.categories.includes(category.name)}
                      onCheckedChange={() => handleArrayFilterToggle('categories', category.name)}
                    />
                    <Label htmlFor={`category-${category.id}`} className="text-sm">
                      {category.name} ({category.studyCount})
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Publication Year Range */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Publication Year</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="year-start">From</Label>
                  <Input
                    id="year-start"
                    type="number"
                    placeholder="2000"
                    min="1990"
                    max={new Date().getFullYear()}
                    value={filters.yearRange.start || ''}
                    onChange={(e) => handleFilterChange('yearRange', {
                      ...filters.yearRange,
                      start: e.target.value ? parseInt(e.target.value) : null
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="year-end">To</Label>
                  <Input
                    id="year-end"
                    type="number"
                    placeholder="2024"
                    min="1990"
                    max={new Date().getFullYear()}
                    value={filters.yearRange.end || ''}
                    onChange={(e) => handleFilterChange('yearRange', {
                      ...filters.yearRange,
                      end: e.target.value ? parseInt(e.target.value) : null
                    })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Study Types */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Study Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {['Clinical Trial', 'Meta-Analysis', 'Systematic Review', 'Animal Study', 'In Vitro Study', 'Observational Study'].map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`type-${type}`}
                      checked={filters.studyTypes.includes(type)}
                      onCheckedChange={() => handleArrayFilterToggle('studyTypes', type)}
                    />
                    <Label htmlFor={`type-${type}`} className="text-sm">
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Availability Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-fulltext"
                  checked={filters.hasFullText === true}
                  onCheckedChange={(checked) => 
                    handleFilterChange('hasFullText', checked ? true : null)
                  }
                />
                <Label htmlFor="has-fulltext" className="text-sm">
                  Full text available
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-doi"
                  checked={filters.hasDOI === true}
                  onCheckedChange={(checked) => 
                    handleFilterChange('hasDOI', checked ? true : null)
                  }
                />
                <Label htmlFor="has-doi" className="text-sm">
                  DOI available
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Sort Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sort Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sort-by">Sort by</Label>
                <Select
                  value={filters.sortBy}
                  onValueChange={(value) => handleFilterChange('sortBy', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="date">Publication Date</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                    <SelectItem value="citations">Citations</SelectItem>
                    <SelectItem value="views">View Count</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="sort-order">Order</Label>
                <Select
                  value={filters.sortOrder}
                  onValueChange={(value: 'asc' | 'desc') => handleFilterChange('sortOrder', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descending</SelectItem>
                    <SelectItem value="asc">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Active Filters Summary */}
        {activeFiltersCount > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Active Filters:</Label>
            <div className="flex flex-wrap gap-2">
              {filters.query && (
                <Badge variant="secondary">
                  Query: "{filters.query}"
                  <button
                    onClick={() => handleFilterChange('query', '')}
                    className="ml-1 hover:bg-gray-200 rounded-full p-1"
                  >
                    <HiX className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {filters.categories.map((category) => (
                <Badge key={category} variant="secondary">
                  {category}
                  <button
                    onClick={() => handleArrayFilterToggle('categories', category)}
                    className="ml-1 hover:bg-gray-200 rounded-full p-1"
                  >
                    <HiX className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              
              {(filters.yearRange.start || filters.yearRange.end) && (
                <Badge variant="secondary">
                  Year: {filters.yearRange.start || '?'} - {filters.yearRange.end || '?'}
                  <button
                    onClick={() => handleFilterChange('yearRange', { start: null, end: null })}
                    className="ml-1 hover:bg-gray-200 rounded-full p-1"
                  >
                    <HiX className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={clearFilters}>
            Clear All Filters
          </Button>
          
          <div className="space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSearch}>
              Apply Filters & Search
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedSearchModal;