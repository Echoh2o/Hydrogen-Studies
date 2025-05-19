import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { 
  Loader2, 
  Plus, 
  Search, 
  Trash, 
  Edit, 
  PlayCircle, 
  Clock, 
  CheckCircle, 
  XCircle,
  Filter,
  Lightbulb,
  AlertCircle,
  Save,
  CalendarClock,
  RefreshCw
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import AdminLayout from "@/components/admin/AdminLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import KeywordEditor from "@/components/admin/keyword-monitor/KeywordEditor";
import ScheduleDialog from "@/components/admin/keyword-monitor/ScheduleDialog";

// Types for keyword monitoring
interface Keyword {
  id: number;
  term: string;
  category: string;
  isActive: boolean;
  lastSearched?: string;
  createdAt: string;
  matchCount?: number;
}

interface KeywordGroup {
  id: number;
  name: string;
  description?: string;
  keywords: Keyword[];
  isActive: boolean;
}

interface ExcludedKeyword {
  id: number;
  term: string;
  reason: string;
}

interface MonitorResult {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  doi: string;
  matchedKeywords: string[];
  status: 'pending' | 'approved' | 'rejected' | 'archived';
  source: string;
  foundAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export default function KeywordMonitorPage() {
  const [activeTab, setActiveTab] = useState("keywords");
  const [selectedKeywords, setSelectedKeywords] = useState<number[]>([]);
  const [selectedResults, setSelectedResults] = useState<number[]>([]);
  const [newKeyword, setNewKeyword] = useState({ term: "", category: "general" });
  const [newExcludedKeyword, setNewExcludedKeyword] = useState({ term: "", reason: "" });
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
  const [editingExcluded, setEditingExcluded] = useState<ExcludedKeyword | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddExcludedDialog, setShowAddExcludedDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<{
    message: string;
    type: "info" | "success" | "error";
    visible: boolean;
  }>({ message: "", type: "info", visible: false });

  // Query for keywords
  const keywordsQuery = useQuery({
    queryKey: ["/api/keywords"],
    enabled: activeTab === "keywords" || activeTab === "groups",
  });

  // Query for excluded keywords
  const excludedKeywordsQuery = useQuery({
    queryKey: ["/api/keywords/excluded"],
    enabled: activeTab === "excluded",
  });

  // Query for keyword groups
  const keywordGroupsQuery = useQuery({
    queryKey: ["/api/keywords/groups"],
    enabled: activeTab === "groups",
  });

  // Query for monitor results
  const monitorResultsQuery = useQuery({
    queryKey: ["/api/keywords/results", statusFilter],
    enabled: activeTab === "results",
  });
  
  // Query for search schedule
  const scheduleQuery = useQuery({
    queryKey: ["/api/keywords/monitor/schedule"],
    enabled: activeTab === "results" || activeTab === "keywords",
  });

  // Mutation for adding a keyword
  const addKeywordMutation = useMutation({
    mutationFn: async (keywordData: { term: string; category: string }) => {
      const response = await fetch("/api/keywords", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(keywordData),
      });
      
      if (!response.ok) throw new Error("Failed to add keyword");
      return response.json();
    },
    onSuccess: () => {
      setProcessingStatus({
        message: "Keyword added successfully",
        type: "success",
        visible: true,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      setNewKeyword({ term: "", category: "general" });
      setShowAddDialog(false);
    },
    onError: (error) => {
      setProcessingStatus({
        message: `Error: ${error.message}`,
        type: "error",
        visible: true,
      });
    },
  });

  // Mutation for adding an excluded keyword
  const addExcludedKeywordMutation = useMutation({
    mutationFn: async (excludedData: { term: string; reason: string }) => {
      const response = await fetch("/api/keywords/excluded", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(excludedData),
      });
      
      if (!response.ok) throw new Error("Failed to add excluded keyword");
      return response.json();
    },
    onSuccess: () => {
      setProcessingStatus({
        message: "Excluded keyword added successfully",
        type: "success",
        visible: true,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/keywords/excluded"] });
      setNewExcludedKeyword({ term: "", reason: "" });
      setShowAddExcludedDialog(false);
    },
    onError: (error) => {
      setProcessingStatus({
        message: `Error: ${error.message}`,
        type: "error",
        visible: true,
      });
    },
  });

  // Mutation for updating keyword status
  const updateKeywordStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const response = await fetch(`/api/keywords/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive }),
      });
      
      if (!response.ok) throw new Error("Failed to update keyword status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
    },
    onError: (error) => {
      setProcessingStatus({
        message: `Error: ${error.message}`,
        type: "error",
        visible: true,
      });
    },
  });

  // Mutation for deleting a keyword
  const deleteKeywordMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/keywords/${id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) throw new Error("Failed to delete keyword");
      return response.json();
    },
    onSuccess: () => {
      setProcessingStatus({
        message: "Keyword deleted successfully",
        type: "success",
        visible: true,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
    },
    onError: (error) => {
      setProcessingStatus({
        message: `Error: ${error.message}`,
        type: "error",
        visible: true,
      });
    },
  });

  // Mutation for running the keyword monitor
  const runMonitorMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/keywords/monitor/run", {
        method: "POST",
      });
      
      if (!response.ok) throw new Error("Failed to run monitor");
      return response.json();
    },
    onSuccess: (data) => {
      setProcessingStatus({
        message: `Monitor ran successfully. Found ${data.found} new studies.`,
        type: "success",
        visible: true,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/keywords/results"] });
    },
    onError: (error) => {
      setProcessingStatus({
        message: `Error: ${error.message}`,
        type: "error",
        visible: true,
      });
    },
  });

  // Mutation for updating a result's status
  const updateResultStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/keywords/results/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) throw new Error("Failed to update result status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords/results"] });
      setSelectedResults([]);
    },
    onError: (error) => {
      setProcessingStatus({
        message: `Error: ${error.message}`,
        type: "error",
        visible: true,
      });
    },
  });

  // Handle adding a new keyword
  const handleAddKeyword = () => {
    if (!newKeyword.term.trim()) {
      setProcessingStatus({
        message: "Keyword term cannot be empty",
        type: "error",
        visible: true,
      });
      return;
    }
    
    addKeywordMutation.mutate(newKeyword);
  };

  // Handle adding a new excluded keyword
  const handleAddExcludedKeyword = () => {
    if (!newExcludedKeyword.term.trim()) {
      setProcessingStatus({
        message: "Excluded keyword term cannot be empty",
        type: "error",
        visible: true,
      });
      return;
    }
    
    addExcludedKeywordMutation.mutate(newExcludedKeyword);
  };

  // Handle toggling keyword status
  const handleToggleStatus = (id: number, currentStatus: boolean) => {
    updateKeywordStatusMutation.mutate({ id, isActive: !currentStatus });
  };

  // Handle deleting a keyword
  const handleDeleteKeyword = (id: number) => {
    if (window.confirm("Are you sure you want to delete this keyword?")) {
      deleteKeywordMutation.mutate(id);
    }
  };

  // Handle running the monitor
  const handleRunMonitor = () => {
    if (window.confirm("Are you sure you want to run the keyword monitor? This may take some time.")) {
      runMonitorMutation.mutate();
    }
  };

  // Handle updating result status
  const handleUpdateResultStatus = (id: number, status: string) => {
    updateResultStatusMutation.mutate({ id, status });
  };

  // Handle batch approving selected results
  const handleBatchApprove = () => {
    if (selectedResults.length === 0) {
      setProcessingStatus({
        message: "No results selected",
        type: "info",
        visible: true,
      });
      return;
    }
    
    if (window.confirm(`Are you sure you want to approve ${selectedResults.length} results?`)) {
      // In a real implementation, this would be a batch operation
      selectedResults.forEach(id => {
        updateResultStatusMutation.mutate({ id, status: "approved" });
      });
    }
  };

  // Handle batch rejecting selected results
  const handleBatchReject = () => {
    if (selectedResults.length === 0) {
      setProcessingStatus({
        message: "No results selected",
        type: "info",
        visible: true,
      });
      return;
    }
    
    if (window.confirm(`Are you sure you want to reject ${selectedResults.length} results?`)) {
      // In a real implementation, this would be a batch operation
      selectedResults.forEach(id => {
        updateResultStatusMutation.mutate({ id, status: "rejected" });
      });
    }
  };

  // Toggle selection of a result
  const toggleResultSelection = (id: number) => {
    setSelectedResults(prev => 
      prev.includes(id) 
        ? prev.filter(resultId => resultId !== id) 
        : [...prev, id]
    );
  };

  // Filter keywords by search term and group
  const getFilteredKeywords = (): Keyword[] => {
    if (!keywordsQuery.data) return [];
    
    const keywords = keywordsQuery.data as Keyword[];
    
    return keywords.filter(keyword => {
      // Apply search filter
      const matchesSearch = searchTerm === "" || 
        keyword.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
        keyword.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Apply group filter
      const matchesGroup = selectedGroup === "all" || keyword.category === selectedGroup;
      
      return matchesSearch && matchesGroup;
    });
  };

  // Filter results by search term and status
  const getFilteredResults = (): MonitorResult[] => {
    if (!monitorResultsQuery.data) return [];
    
    const results = monitorResultsQuery.data as MonitorResult[];
    
    return results.filter(result => {
      // Apply search filter
      const matchesSearch = searchTerm === "" || 
        result.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.abstract.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.authors.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.journal.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Apply status filter
      const matchesStatus = statusFilter === "all" || result.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  };

  // Close status alert
  const closeStatusAlert = () => {
    setProcessingStatus({ ...processingStatus, visible: false });
  };

  // Get the filtered data
  const filteredKeywords = getFilteredKeywords();
  const filteredResults = getFilteredResults();
  const excludedKeywords = excludedKeywordsQuery.data as ExcludedKeyword[] || [];
  
  // Get unique categories for filter dropdown
  const uniqueCategories = keywordsQuery.data 
    ? Array.from(new Set((keywordsQuery.data as Keyword[]).map(k => k.category))) 
    : [];

  return (
    <AdminLayout 
      title="Keyword Monitor" 
      description="Manage keywords and monitor scientific databases for new studies"
    >
      {/* Status Alert */}
      {processingStatus.visible && (
        <Alert 
          variant={processingStatus.type === "error" ? "destructive" : "default"}
          className="mb-4"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {processingStatus.type === "success" 
              ? "Success" 
              : processingStatus.type === "error" 
                ? "Error" 
                : "Information"}
          </AlertTitle>
          <AlertDescription>{processingStatus.message}</AlertDescription>
          <Button 
            variant="ghost" 
            size="sm" 
            className="absolute top-2 right-2"
            onClick={closeStatusAlert}
          >
            ✕
          </Button>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="keywords" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
            <TabsTrigger value="excluded">Excluded Terms</TabsTrigger>
            <TabsTrigger value="groups">Keyword Groups</TabsTrigger>
            <TabsTrigger value="results">Monitor Results</TabsTrigger>
          </TabsList>
          
          <div className="flex space-x-2">
            {activeTab === "keywords" && (
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Keyword
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Keyword</DialogTitle>
                    <DialogDescription>
                      Add a keyword to monitor for in scientific databases
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="term">Keyword Term</Label>
                      <Input
                        id="term"
                        value={newKeyword.term}
                        onChange={(e) => setNewKeyword({ ...newKeyword, term: e.target.value })}
                        placeholder="e.g., hydrogen-rich water"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={newKeyword.category}
                        onValueChange={(value) => setNewKeyword({ ...newKeyword, category: value })}
                      >
                        <SelectTrigger id="category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="medical">Medical</SelectItem>
                          <SelectItem value="disease">Disease</SelectItem>
                          <SelectItem value="mechanism">Mechanism</SelectItem>
                          <SelectItem value="delivery">Delivery Method</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddKeyword} disabled={addKeywordMutation.isPending}>
                      {addKeywordMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add Keyword"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            
            {activeTab === "excluded" && (
              <Dialog open={showAddExcludedDialog} onOpenChange={setShowAddExcludedDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Excluded Term
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Excluded Keyword</DialogTitle>
                    <DialogDescription>
                      Add a term to exclude from search results
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="excluded-term">Term to Exclude</Label>
                      <Input
                        id="excluded-term"
                        value={newExcludedKeyword.term}
                        onChange={(e) => setNewExcludedKeyword({ ...newExcludedKeyword, term: e.target.value })}
                        placeholder="e.g., hydrogen fuel cell"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="reason">Reason for Exclusion</Label>
                      <Textarea
                        id="reason"
                        value={newExcludedKeyword.reason}
                        onChange={(e) => setNewExcludedKeyword({ ...newExcludedKeyword, reason: e.target.value })}
                        placeholder="e.g., Not related to medical applications"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddExcludedDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddExcludedKeyword} disabled={addExcludedKeywordMutation.isPending}>
                      {addExcludedKeywordMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add Excluded Term"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            
            {activeTab === "results" && (
              <div className="flex space-x-2">
                <Button onClick={handleRunMonitor} disabled={runMonitorMutation.isPending}>
                  {runMonitorMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Run Monitor
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => setShowScheduleDialog(true)}
                >
                  <CalendarClock className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
              </div>
            )}
            
            {activeTab === "keywords" && (
              <Button 
                variant="outline" 
                onClick={() => setShowScheduleDialog(true)}
              >
                <CalendarClock className="h-4 w-4 mr-2" />
                Schedule Auto Search
              </Button>
            )}
          </div>
        </div>

        {/* Search and filter row */}
        <div className="flex items-center justify-between mb-4 space-x-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 max-w-sm"
            />
          </div>
          
          {activeTab === "keywords" && (
            <div className="flex items-center space-x-2">
              <Select
                value={selectedGroup}
                onValueChange={setSelectedGroup}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {activeTab === "results" && (
            <div className="flex items-center space-x-2">
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={handleBatchApprove}
                  disabled={selectedResults.length === 0}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Selected ({selectedResults.length})
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleBatchReject}
                  disabled={selectedResults.length === 0}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Selected ({selectedResults.length})
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Keywords Tab */}
        <TabsContent value="keywords">
          <Card>
            <CardHeader>
              <CardTitle>Monitored Keywords</CardTitle>
              <CardDescription>
                Keywords to search for in medical research databases
              </CardDescription>
            </CardHeader>
            <CardContent>
              {keywordsQuery.isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : keywordsQuery.isError ? (
                <div className="text-center py-10 text-destructive">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>Failed to load keywords. Please try again.</p>
                </div>
              ) : filteredKeywords.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <p>No keywords found. Add some to start monitoring.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Term</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Search</TableHead>
                        <TableHead>Matches</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredKeywords.map((keyword) => (
                        <TableRow key={keyword.id}>
                          <TableCell>{keyword.term}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{keyword.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={keyword.isActive}
                                onCheckedChange={() => handleToggleStatus(keyword.id, keyword.isActive)}
                              />
                              <span>{keyword.isActive ? "Active" : "Inactive"}</span>
                            </div>
                          </TableCell>
                          <TableCell>{keyword.lastSearched || "Never"}</TableCell>
                          <TableCell>{keyword.matchCount || 0}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setEditingKeyword(keyword)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDeleteKeyword(keyword.id)}
                              >
                                <Trash className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="text-xs text-muted-foreground">
                {keywordsQuery.data ? (keywordsQuery.data as Keyword[]).length : 0} total keywords
              </div>
            </CardFooter>
          </Card>

          {/* Edit Keyword Dialog */}
          {editingKeyword && (
            <Dialog open={!!editingKeyword} onOpenChange={() => setEditingKeyword(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Keyword</DialogTitle>
                  <DialogDescription>
                    Update keyword details
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-term">Keyword Term</Label>
                    <Input
                      id="edit-term"
                      value={editingKeyword.term}
                      onChange={(e) => setEditingKeyword({ ...editingKeyword, term: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-category">Category</Label>
                    <Select
                      value={editingKeyword.category}
                      onValueChange={(value) => setEditingKeyword({ ...editingKeyword, category: value })}
                    >
                      <SelectTrigger id="edit-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="medical">Medical</SelectItem>
                        <SelectItem value="disease">Disease</SelectItem>
                        <SelectItem value="mechanism">Mechanism</SelectItem>
                        <SelectItem value="delivery">Delivery Method</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-active"
                      checked={editingKeyword.isActive}
                      onCheckedChange={(checked) => 
                        setEditingKeyword({ ...editingKeyword, isActive: checked as boolean })
                      }
                    />
                    <Label htmlFor="edit-active">Active</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingKeyword(null)}>
                    Cancel
                  </Button>
                  <Button>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        {/* Excluded Keywords Tab */}
        <TabsContent value="excluded">
          <Card>
            <CardHeader>
              <CardTitle>Excluded Terms</CardTitle>
              <CardDescription>
                Terms that will exclude studies from search results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {excludedKeywordsQuery.isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : excludedKeywordsQuery.isError ? (
                <div className="text-center py-10 text-destructive">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>Failed to load excluded terms. Please try again.</p>
                </div>
              ) : excludedKeywords.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <p>No excluded terms found. Add some to filter out irrelevant results.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Term</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {excludedKeywords
                        .filter(keyword => 
                          searchTerm === "" || 
                          keyword.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          keyword.reason.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((keyword) => (
                        <TableRow key={keyword.id}>
                          <TableCell>{keyword.term}</TableCell>
                          <TableCell>{keyword.reason}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setEditingExcluded(keyword)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {/* Handle delete */}}
                              >
                                <Trash className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="text-xs text-muted-foreground">
                {excludedKeywords.length} total excluded terms
              </div>
            </CardFooter>
          </Card>

          {/* Edit Excluded Keyword Dialog */}
          {editingExcluded && (
            <Dialog open={!!editingExcluded} onOpenChange={() => setEditingExcluded(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Excluded Term</DialogTitle>
                  <DialogDescription>
                    Update excluded term details
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-excluded-term">Term</Label>
                    <Input
                      id="edit-excluded-term"
                      value={editingExcluded.term}
                      onChange={(e) => setEditingExcluded({ ...editingExcluded, term: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-reason">Reason</Label>
                    <Textarea
                      id="edit-reason"
                      value={editingExcluded.reason}
                      onChange={(e) => setEditingExcluded({ ...editingExcluded, reason: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingExcluded(null)}>
                    Cancel
                  </Button>
                  <Button>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        {/* Keyword Groups Tab */}
        <TabsContent value="groups">
          <Card>
            <CardHeader>
              <CardTitle>Keyword Groups</CardTitle>
              <CardDescription>
                Organize keywords by purpose or topic
              </CardDescription>
            </CardHeader>
            <CardContent>
              {keywordGroupsQuery.isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : keywordGroupsQuery.isError ? (
                <div className="text-center py-10 text-destructive">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>Failed to load keyword groups. Please try again.</p>
                </div>
              ) : !(keywordGroupsQuery.data as KeywordGroup[])?.length ? (
                <div className="text-center py-10 text-muted-foreground">
                  <p>No keyword groups found. Create groups to organize your keywords.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {(keywordGroupsQuery.data as KeywordGroup[]).map((group) => (
                    <Card key={group.id} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle>{group.name}</CardTitle>
                          <Badge variant={group.isActive ? "default" : "secondary"}>
                            {group.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <CardDescription>{group.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {group.keywords.map((keyword) => (
                            <Badge 
                              key={keyword.id} 
                              variant="outline"
                              className={keyword.isActive ? "bg-green-50" : "bg-gray-50"}
                            >
                              {keyword.term}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter className="bg-muted/50">
                        <div className="flex w-full justify-between">
                          <span className="text-xs text-muted-foreground">
                            {group.keywords.length} keywords
                          </span>
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash className="h-4 w-4 mr-1 text-destructive" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Monitor Results Tab */}
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Monitor Results</CardTitle>
              <CardDescription>
                Studies found by the keyword monitor
              </CardDescription>
            </CardHeader>
            <CardContent>
              {monitorResultsQuery.isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : monitorResultsQuery.isError ? (
                <div className="text-center py-10 text-destructive">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>Failed to load monitor results. Please try again.</p>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <p>No monitor results found. Run the monitor to find new studies.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={
                              filteredResults.length > 0 && 
                              selectedResults.length === filteredResults.length
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedResults(filteredResults.map(r => r.id));
                              } else {
                                setSelectedResults([]);
                              }
                            }}
                            aria-label="Select all"
                          />
                        </TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Matched Keywords</TableHead>
                        <TableHead>Found</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.map((result) => (
                        <TableRow key={result.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedResults.includes(result.id)}
                              onCheckedChange={() => toggleResultSelection(result.id)}
                              aria-label={`Select result ${result.id}`}
                            />
                          </TableCell>
                          <TableCell className="max-w-md truncate">
                            <div>
                              <div className="font-medium">{result.title}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {result.authors} | {result.journal}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{result.source}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {result.matchedKeywords.map((keyword) => (
                                <Badge key={keyword} variant="outline">
                                  {keyword}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>{result.foundAt}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                result.status === "approved" 
                                  ? "success" 
                                  : result.status === "rejected" 
                                    ? "destructive" 
                                    : result.status === "archived" 
                                      ? "outline" 
                                      : "default"
                              }
                            >
                              {result.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUpdateResultStatus(result.id, "approved")}
                                disabled={result.status === "approved"}
                              >
                                <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUpdateResultStatus(result.id, "rejected")}
                                disabled={result.status === "rejected"}
                              >
                                <XCircle className="h-4 w-4 mr-1 text-red-500" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="text-xs text-muted-foreground">
                {monitorResultsQuery.data ? (monitorResultsQuery.data as MonitorResult[]).length : 0} total results
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schedule Dialog */}
      <ScheduleDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        currentSchedule={scheduleQuery.data as {
          enabled: boolean;
          frequency: string;
          time: string;
          days: string[];
          sources: string[];
        } | null}
      />
    </AdminLayout>
  );
}