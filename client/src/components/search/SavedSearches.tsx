/**
 * Saved Searches Component for User Convenience
 * Allows users to save and quickly access frequent search queries
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { HiBookmark, HiTrash, HiEdit, HiSearch, HiPlus } from "react-icons/hi";
import { useToast } from "@/hooks/use-toast";

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: any;
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
}

interface SavedSearchesProps {
  onLoadSearch: (search: SavedSearch) => void;
  currentSearch?: {
    query: string;
    filters: any;
  };
}

export const SavedSearches: React.FC<SavedSearchesProps> = ({
  onLoadSearch,
  currentSearch
}) => {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);
  const { toast } = useToast();

  // Load saved searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('hydrogenstudies_saved_searches');
    if (saved) {
      try {
        const parsed = JSON.parse(saved).map((search: any) => ({
          ...search,
          createdAt: new Date(search.createdAt),
          lastUsed: new Date(search.lastUsed)
        }));
        setSavedSearches(parsed);
      } catch (error) {
        console.error('Error loading saved searches:', error);
      }
    }
  }, []);

  // Save searches to localStorage
  const saveToStorage = (searches: SavedSearch[]) => {
    localStorage.setItem('hydrogenstudies_saved_searches', JSON.stringify(searches));
    setSavedSearches(searches);
  };

  // Save current search
  const saveCurrentSearch = () => {
    if (!currentSearch || !searchName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for your search",
        variant: "destructive"
      });
      return;
    }

    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name: searchName.trim(),
      query: currentSearch.query,
      filters: currentSearch.filters,
      createdAt: new Date(),
      lastUsed: new Date(),
      useCount: 0
    };

    const updated = [newSearch, ...savedSearches].slice(0, 20); // Keep max 20 saved searches
    saveToStorage(updated);
    
    setSearchName('');
    setIsModalOpen(false);
    
    toast({
      title: "Success",
      description: "Search saved successfully"
    });
  };

  // Update existing search
  const updateSearch = () => {
    if (!editingSearch || !searchName.trim()) return;

    const updated = savedSearches.map(search => 
      search.id === editingSearch.id 
        ? { ...search, name: searchName.trim() }
        : search
    );
    
    saveToStorage(updated);
    setEditingSearch(null);
    setSearchName('');
    setIsModalOpen(false);
    
    toast({
      title: "Success",
      description: "Search updated successfully"
    });
  };

  // Load saved search
  const loadSearch = (search: SavedSearch) => {
    const updated = savedSearches.map(s => 
      s.id === search.id 
        ? { ...s, lastUsed: new Date(), useCount: s.useCount + 1 }
        : s
    );
    saveToStorage(updated);
    onLoadSearch(search);
    
    toast({
      title: "Search Loaded",
      description: `Loaded search: ${search.name}`
    });
  };

  // Delete saved search
  const deleteSearch = (searchId: string) => {
    const updated = savedSearches.filter(s => s.id !== searchId);
    saveToStorage(updated);
    
    toast({
      title: "Search Deleted",
      description: "Saved search removed"
    });
  };

  // Open edit modal
  const openEditModal = (search: SavedSearch) => {
    setEditingSearch(search);
    setSearchName(search.name);
    setIsModalOpen(true);
  };

  // Open save modal
  const openSaveModal = () => {
    setEditingSearch(null);
    setSearchName('');
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Saved Searches</h3>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              onClick={openSaveModal}
              disabled={!currentSearch?.query}
            >
              <HiPlus className="h-4 w-4 mr-1" />
              Save Current Search
            </Button>
          </DialogTrigger>
          
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSearch ? 'Edit Saved Search' : 'Save Current Search'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="search-name">Search Name</Label>
                <Input
                  id="search-name"
                  placeholder="Enter a name for this search..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      editingSearch ? updateSearch() : saveCurrentSearch();
                    }
                  }}
                />
              </div>
              
              {currentSearch && !editingSearch && (
                <div className="text-sm text-gray-600">
                  <p><strong>Query:</strong> {currentSearch.query || 'All studies'}</p>
                  <p><strong>Filters:</strong> {
                    Object.keys(currentSearch.filters || {}).length > 0 
                      ? `${Object.keys(currentSearch.filters).length} active filters`
                      : 'No filters'
                  }</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={editingSearch ? updateSearch : saveCurrentSearch}>
                  {editingSearch ? 'Update' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {savedSearches.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <HiBookmark className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>No saved searches yet</p>
            <p className="text-sm">Save your frequent searches for quick access</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {savedSearches
            .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
            .map((search) => (
              <Card key={search.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{search.name}</h4>
                        <Badge variant="secondary" className="text-xs">
                          Used {search.useCount} times
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-gray-600 mt-1">
                        <p className="truncate">
                          <strong>Query:</strong> {search.query || 'All studies'}
                        </p>
                        <p className="text-xs">
                          Last used: {search.lastUsed.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadSearch(search)}
                        title="Load this search"
                      >
                        <HiSearch className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(search)}
                        title="Edit search name"
                      >
                        <HiEdit className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSearch(search.id)}
                        title="Delete saved search"
                        className="text-red-600 hover:text-red-700"
                      >
                        <HiTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
};

export default SavedSearches;