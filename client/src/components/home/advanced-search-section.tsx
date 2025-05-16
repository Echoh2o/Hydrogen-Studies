import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdvancedSearchSection() {
  const [, setLocation] = useLocation();
  const [searchParams, setSearchParams] = useState({
    keyword: "",
    author: "",
    yearFrom: "",
    yearTo: "",
    category: "",
    peerReviewed: false
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value: string) => {
    setSearchParams(prev => ({ ...prev, category: value }));
  };

  const handleCheckboxChange = (checked: boolean) => {
    setSearchParams(prev => ({ ...prev, peerReviewed: checked }));
  };

  const handleAdvancedSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    const queryParams = new URLSearchParams();
    
    if (searchParams.keyword) queryParams.append("keyword", searchParams.keyword);
    if (searchParams.author) queryParams.append("author", searchParams.author);
    if (searchParams.yearFrom) queryParams.append("yearFrom", searchParams.yearFrom);
    if (searchParams.yearTo) queryParams.append("yearTo", searchParams.yearTo);
    if (searchParams.category) queryParams.append("category", searchParams.category);
    if (searchParams.peerReviewed) queryParams.append("peerReviewed", "true");
    
    setLocation(`/studies?${queryParams.toString()}`);
  };

  return (
    <section className="py-10 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-neutral-100 rounded-xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold font-heading text-neutral-900 mb-6">Advanced Search</h2>
            <form onSubmit={handleAdvancedSearch}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <Label htmlFor="keyword" className="text-neutral-700 font-medium">Keywords</Label>
                  <Input
                    id="keyword"
                    name="keyword"
                    placeholder="e.g., antioxidant, inflammation"
                    className="w-full border border-neutral-300 mt-2"
                    value={searchParams.keyword}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <Label htmlFor="author" className="text-neutral-700 font-medium">Author</Label>
                  <Input
                    id="author"
                    name="author"
                    placeholder="e.g., Smith, Johnson"
                    className="w-full border border-neutral-300 mt-2"
                    value={searchParams.author}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <Label htmlFor="yearFrom" className="text-neutral-700 font-medium">Year Range</Label>
                  <div className="flex space-x-2 mt-2">
                    <Input
                      id="yearFrom"
                      name="yearFrom"
                      type="number"
                      placeholder="From"
                      className="w-1/2 border border-neutral-300"
                      value={searchParams.yearFrom}
                      onChange={handleChange}
                    />
                    <Input
                      id="yearTo"
                      name="yearTo"
                      type="number"
                      placeholder="To"
                      className="w-1/2 border border-neutral-300"
                      value={searchParams.yearTo}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="category" className="text-neutral-700 font-medium">Category</Label>
                  <Select
                    value={searchParams.category}
                    onValueChange={handleSelectChange}
                  >
                    <SelectTrigger id="category" className="w-full border border-neutral-300 mt-2">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="neurodegenerative">Neurodegenerative Diseases</SelectItem>
                      <SelectItem value="cardiovascular">Cardiovascular Health</SelectItem>
                      <SelectItem value="metabolism">Metabolism & Diabetes</SelectItem>
                      <SelectItem value="inflammation">Inflammation</SelectItem>
                      <SelectItem value="cancer">Cancer Research</SelectItem>
                      <SelectItem value="aging">Anti-Aging</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="peer-reviewed" 
                    checked={searchParams.peerReviewed}
                    onCheckedChange={handleCheckboxChange}
                  />
                  <Label 
                    htmlFor="peer-reviewed" 
                    className="text-sm text-neutral-700"
                  >
                    Peer-reviewed only
                  </Label>
                </div>
                <Button type="submit" className="bg-primary text-white hover:bg-primary/90">
                  Search Studies
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
