import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  PlusCircle, 
  Loader2, 
  Search, 
  ArrowUpDown,
  Filter,
  Check,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export default function StudiesPage() {
  // Filter and search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");

  // Fetch studies
  const studiesQuery = useQuery({
    queryKey: ["/api/studies"],
  });

  // Fetch categories for filtering
  const categoriesQuery = useQuery({
    queryKey: ["/api/categories"],
  });

  // Loading state
  if (studiesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (studiesQuery.isError) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>
          Failed to load studies. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  // Make sure studies data is properly handled as an array
  const studies = Array.isArray(studiesQuery.data) ? studiesQuery.data : [];
  const categories = Array.isArray(categoriesQuery.data) ? categoriesQuery.data : [];

  // Filter and sort studies
  const filteredStudies = studies.filter((study) => {
    // Apply category filter
    if (selectedCategory !== "all" && study.category !== selectedCategory) {
      return false;
    }

    // Apply search filter (case-insensitive)
    if (searchQuery && searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      return (
        study.title?.toLowerCase().includes(query) ||
        study.authors?.toLowerCase().includes(query) ||
        study.abstract?.toLowerCase().includes(query) ||
        study.journal?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Sort filtered studies
  const sortedStudies = [...filteredStudies].sort((a, b) => {
    let comparison = 0;

    if (sortBy === "date") {
      const dateA = new Date(a.publishDate || a.createdAt).getTime();
      const dateB = new Date(b.publishDate || b.createdAt).getTime();
      comparison = dateA - dateB;
    } else if (sortBy === "title") {
      comparison = a.title.localeCompare(b.title);
    } else if (sortBy === "category") {
      comparison = a.category.localeCompare(b.category);
    }

    // Apply sort direction
    return sortDirection === "desc" ? -comparison : comparison;
  });

  // Toggle sort
  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDirection("desc");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0">
          <div>
            <CardTitle>Manage Studies</CardTitle>
            <CardDescription>
              View, edit, and manage hydrogen research studies in the database
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/admin/studies/add">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Study
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters and search */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search studies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Category
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                  onClick={() => setSelectedCategory("all")}
                  className="flex items-center justify-between"
                  key="all"
                >
                  All Categories
                  {selectedCategory === "all" && (
                    <Check className="h-4 w-4" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {categories.map((category) => (
                  <DropdownMenuItem 
                    key={category.name}
                    onClick={() => setSelectedCategory(category.name)}
                    className="flex items-center justify-between"
                  >
                    {category.name}
                    {selectedCategory === category.name && (
                      <Check className="h-4 w-4" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toggleSort("date")} key="date">
                  Date {sortBy === "date" && (sortDirection === "asc" ? "(Oldest)" : "(Newest)")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleSort("title")} key="title">
                  Title {sortBy === "title" && (sortDirection === "asc" ? "(A-Z)" : "(Z-A)")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleSort("category")} key="category">
                  Category {sortBy === "category" && (sortDirection === "asc" ? "(A-Z)" : "(Z-A)")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Studies table */}
        {sortedStudies.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No studies found matching your criteria.
            </p>
            {searchQuery || selectedCategory !== "all" ? (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
              >
                <X className="h-4 w-4 mr-2" /> Clear Filters
              </Button>
            ) : (
              <Button asChild>
                <Link href="/admin/research-import">Find New Studies</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[350px]">Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Authors</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Enrichment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStudies.map((study) => (
                  <TableRow key={study.id}>
                    <TableCell className="font-medium">
                      <div className="max-w-xs truncate">{study.title}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{study.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[150px] truncate">{study.authors}</div>
                    </TableCell>
                    <TableCell>
                      {new Date(study.publishDate || study.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {study.hasFullText ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                          <Check className="h-3 w-3 mr-1" /> Enriched
                        </Badge>
                      ) : (
                        <Badge variant="outline">Needs Enrichment</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild className="mr-1">
                        <Link href={`/admin/studies/edit/${study.id}`}>
                          Edit
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/study/${study.id}`}>
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          Showing {sortedStudies.length} of {studies.length} studies
        </p>
      </CardFooter>
    </Card>
  );
}