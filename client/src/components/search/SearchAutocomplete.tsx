/**
 * Intelligent Search Autocomplete with Smart Suggestions
 * Provides real-time search suggestions and query completion
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HiSearch, HiClock, HiFire, HiBookmark, HiX } from "react-icons/hi";
import { useQuery } from "@tanstack/react-query";
import { debounce } from "lodash";

interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

interface SearchSuggestion {
  id: string;
  text: string;
  type: "query" | "study" | "category" | "author" | "journal";
  studyCount?: number;
  category?: string;
  relevanceScore?: number;
}

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = "Search hydrogen research studies...",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("hydrogenstudies_recent_searches");
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Debounced search for suggestions
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      if (query.length >= 2) {
        setIsOpen(true);
      }
    }, 300),
    [],
  );

  // Fetch search suggestions
  const { data: suggestions = [], isLoading } = useQuery<SearchSuggestion[]>({
    queryKey: ["/api/search/suggestions", value],
    enabled: value.length >= 2,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Handle input change
  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    setSelectedIndex(-1);
    debouncedSearch(newValue);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: SearchSuggestion | string) => {
    const searchQuery =
      typeof suggestion === "string" ? suggestion : suggestion.text;
    onChange(searchQuery);
    onSearch(searchQuery);
    setIsOpen(false);
    saveRecentSearch(searchQuery);
  };

  // Save recent search
  const saveRecentSearch = (query: string) => {
    const updated = [query, ...recentSearches.filter((s) => s !== query)].slice(
      0,
      5,
    );
    setRecentSearches(updated);
    localStorage.setItem(
      "hydrogenstudies_recent_searches",
      JSON.stringify(updated),
    );
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem("hydrogenstudies_recent_searches");
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    const totalSuggestions = suggestions.length + recentSearches.length;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalSuggestions);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev <= 0 ? totalSuggestions - 1 : prev - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          const allSuggestions = [
            ...suggestions,
            ...recentSearches.map((text) => ({ text, type: "query" as const })),
          ];
          handleSuggestionSelect(allSuggestions[selectedIndex]);
        } else if (value.trim()) {
          onSearch(value.trim());
          setIsOpen(false);
          saveRecentSearch(value.trim());
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Get icon for suggestion type
  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case "study":
        return <HiBookmark className="h-4 w-4 text-teal-500" />;
      case "category":
        return <HiFire className="h-4 w-4 text-orange-500" />;
      case "author":
        return <HiSearch className="h-4 w-4 text-purple-500" />;
      case "journal":
        return <HiBookmark className="h-4 w-4 text-green-500" />;
      default:
        return <HiSearch className="h-4 w-4 text-gray-500" />;
    }
  };

  // Highlight matching text
  const highlightText = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return parts.map((part: string, index: number) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={index} className="bg-yellow-200 font-medium">
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          className="pr-10"
        />
        <Button
          size="sm"
          variant="ghost"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
          onClick={() => {
            if (value.trim()) {
              onSearch(value.trim());
              saveRecentSearch(value.trim());
            }
          }}
        >
          <HiSearch className="h-4 w-4" />
        </Button>
      </div>

      {isOpen && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-96 overflow-y-auto">
          <CardContent className="p-0">
            {/* Recent Searches */}
            {recentSearches.length > 0 && value.length < 2 && (
              <div className="p-3 border-b">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    Recent Searches
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearRecentSearches}
                    className="h-6 px-2 text-xs"
                  >
                    <HiX className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
                <div className="space-y-1">
                  {recentSearches.map((search, index) => (
                    <button
                      key={search}
                      className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 flex items-center gap-2 ${
                        selectedIndex === suggestions.length + index
                          ? "bg-gray-100"
                          : ""
                      }`}
                      onClick={() => handleSuggestionSelect(search)}
                    >
                      <HiClock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{search}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Suggestions */}
            {suggestions.length > 0 && (
              <div className="p-1">
                {suggestions.map((suggestion: SearchSuggestion, index) => (
                  <button
                    key={suggestion.id}
                    className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 flex items-center gap-3 ${
                      selectedIndex === index ? "bg-gray-100" : ""
                    }`}
                    onClick={() => handleSuggestionSelect(suggestion)}
                  >
                    {getSuggestionIcon(suggestion.type)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        {highlightText(suggestion.text, value)}
                      </div>
                      {suggestion.studyCount && (
                        <div className="text-xs text-gray-500">
                          {suggestion.studyCount} studies
                        </div>
                      )}
                    </div>
                    {suggestion.type !== "query" && (
                      <Badge variant="secondary" className="text-xs">
                        {suggestion.type}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-spin h-4 w-4 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <span className="text-sm">Searching...</span>
              </div>
            )}

            {/* No Results */}
            {!isLoading && suggestions.length === 0 && value.length >= 2 && (
              <div className="p-4 text-center text-gray-500">
                <HiSearch className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <span className="text-sm">No suggestions found</span>
                <div className="text-xs mt-1">
                  Try different keywords or check spelling
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SearchAutocomplete;
