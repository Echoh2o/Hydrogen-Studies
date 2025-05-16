import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useNavigate } from "wouter";
import { HiSearch, HiChevronDown, HiChevronUp, HiAdjustments } from "react-icons/hi";

const SearchSection = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("");
  const [year, setYear] = useState("");
  const [sort, setSort] = useState("relevance");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [author, setAuthor] = useState("");
  const [journal, setJournal] = useState("");
  const [studyType, setStudyType] = useState("");
  const [fullTextOnly, setFullTextOnly] = useState(false);
  
  const navigate = useNavigate();

  const toggleAdvanced = () => {
    setIsAdvancedOpen(!isAdvancedOpen);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Build query string
    const params = new URLSearchParams();
    if (searchQuery) params.append("query", searchQuery);
    if (category) params.append("category", category);
    if (year) params.append("year", year);
    if (sort) params.append("sort", sort);
    
    // Add advanced search params
    if (isAdvancedOpen) {
      if (author) params.append("author", author);
      if (journal) params.append("journal", journal);
      if (studyType) params.append("studyType", studyType);
      if (fullTextOnly) params.append("fullTextOnly", "true");
    }
    
    // Navigate to search results page with query parameters
    navigate(`/search?${params.toString()}`);
  };

  return (
    <section id="search-section" className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Search Hydrogen Studies</h2>
          <p className="text-neutral-600 text-center mb-8">Find relevant research on hydrogen gas for health and medical applications</p>
          
          <div className="bg-neutral-100 p-6 rounded-xl shadow-sm mb-8">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex items-center relative">
                <Input 
                  type="text"
                  placeholder="Search by keyword, author, title..."
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-primary/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button 
                  type="submit" 
                  size="icon"
                  variant="ghost"
                  className="absolute right-0 top-0 h-full px-4 text-neutral-500 hover:text-primary"
                >
                  <HiSearch size={20} />
                </Button>
              </div>
              
              <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                <div className="md:w-1/3">
                  <Label htmlFor="category" className="block text-sm font-medium text-neutral-700 mb-1">
                    Category
                  </Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category" className="w-full p-2 rounded-md border border-neutral-300 focus:ring-2 focus:ring-primary/50">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Categories</SelectItem>
                      <SelectItem value="neurology">Neurology</SelectItem>
                      <SelectItem value="cardiology">Cardiology</SelectItem>
                      <SelectItem value="immunology">Immunology</SelectItem>
                      <SelectItem value="metabolism">Metabolism</SelectItem>
                      <SelectItem value="longevity">Longevity</SelectItem>
                      <SelectItem value="clinical-trials">Clinical Trials</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="md:w-1/3">
                  <Label htmlFor="year" className="block text-sm font-medium text-neutral-700 mb-1">
                    Year
                  </Label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger id="year" className="w-full p-2 rounded-md border border-neutral-300 focus:ring-2 focus:ring-primary/50">
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Years</SelectItem>
                      <SelectItem value="2023">2023</SelectItem>
                      <SelectItem value="2022">2022</SelectItem>
                      <SelectItem value="2021">2021</SelectItem>
                      <SelectItem value="2020">2020</SelectItem>
                      <SelectItem value="2019">2019</SelectItem>
                      <SelectItem value="before-2019">Before 2019</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="md:w-1/3">
                  <Label htmlFor="sort" className="block text-sm font-medium text-neutral-700 mb-1">
                    Sort By
                  </Label>
                  <Select value={sort} onValueChange={setSort}>
                    <SelectTrigger id="sort" className="w-full p-2 rounded-md border border-neutral-300 focus:ring-2 focus:ring-primary/50">
                      <SelectValue placeholder="Relevance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="date-desc">Newest First</SelectItem>
                      <SelectItem value="date-asc">Oldest First</SelectItem>
                      <SelectItem value="citations">Most Cited</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="text-primary hover:text-primary-dark text-sm font-medium flex items-center"
                  onClick={toggleAdvanced}
                >
                  {isAdvancedOpen ? <HiChevronUp className="mr-2" /> : <HiAdjustments className="mr-2" />}
                  Advanced Search
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-medium transition">
                  Search
                </Button>
              </div>
              
              {isAdvancedOpen && (
                <div className="pt-4 border-t border-neutral-200 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="author" className="block text-sm font-medium text-neutral-700 mb-1">
                        Author
                      </Label>
                      <Input 
                        type="text" 
                        id="author" 
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        className="w-full p-2 rounded-md border border-neutral-300 focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div>
                      <Label htmlFor="journal" className="block text-sm font-medium text-neutral-700 mb-1">
                        Journal
                      </Label>
                      <Input 
                        type="text" 
                        id="journal"
                        value={journal}
                        onChange={(e) => setJournal(e.target.value)}
                        className="w-full p-2 rounded-md border border-neutral-300 focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div>
                      <Label htmlFor="study-type" className="block text-sm font-medium text-neutral-700 mb-1">
                        Study Type
                      </Label>
                      <Select value={studyType} onValueChange={setStudyType}>
                        <SelectTrigger id="study-type" className="w-full p-2 rounded-md border border-neutral-300 focus:ring-2 focus:ring-primary/50">
                          <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All Types</SelectItem>
                          <SelectItem value="clinical-trial">Clinical Trial</SelectItem>
                          <SelectItem value="meta-analysis">Meta-Analysis</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="case-study">Case Study</SelectItem>
                          <SelectItem value="animal-study">Animal Study</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center h-full pt-6">
                      <label className="flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={fullTextOnly}
                          onChange={(e) => setFullTextOnly(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="h-6 w-6 border-2 border-neutral-300 rounded-md peer-checked:bg-primary peer-checked:border-primary relative">
                          {fullTextOnly && <div className="absolute text-white top-0 left-0 w-full h-full flex items-center justify-center">✓</div>}
                        </div>
                        <span className="ml-2 text-neutral-700">Open Access Only</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SearchSection;
