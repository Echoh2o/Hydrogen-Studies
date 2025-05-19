import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  RefreshCw, 
  XCircle, 
  Clock, 
  FilterX, 
  Info,
  Search
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import AdminLayout from "@/components/admin/AdminLayout";

// Types for our enrichment system
interface Study {
  id: number;
  title: string;
  journal: string;
  publishDate: string;
  doi: string;
  authors: string;
  abstract?: string;
  methods?: string;
  results?: string;
  conclusion?: string;
  imageUrl?: string;
  enhancedFields?: string[];
  status?: 'pending' | 'processing' | 'success' | 'failed';
  errorMessage?: string;
}

interface EnrichmentResult {
  success: boolean;
  message: string;
  studyId: number;
  updates?: {
    abstract?: boolean;
    methods?: boolean;
    results?: boolean;
    conclusion?: boolean;
    imageUrl?: boolean;
    [key: string]: boolean | undefined;
  };
}

interface BatchResult {
  message: string;
  processed: number;
  success: number;
  failed: number;
  errors?: Array<{studyId: number; error: string}>;
  enhancedStudies?: Array<{id: number; title: string}>;
}

export default function EnhancementPage() {
  // State management
  const [activeTab, setActiveTab] = useState("candidates");
  const [selectedStudies, setSelectedStudies] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<{
    message: string;
    type: "info" | "success" | "error";
    visible: boolean;
  }>({ message: "", type: "info", visible: false });
  const [batchProgress, setBatchProgress] = useState<{
    inProgress: boolean;
    completed: number;
    total: number;
    successCount: number;
    failureCount: number;
  }>({
    inProgress: false,
    completed: 0,
    total: 0,
    successCount: 0,
    failureCount: 0
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [failedOnlyFilter, setFailedOnlyFilter] = useState(false);
  const [statusCounts, setStatusCounts] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    success: 0,
    failed: 0
  });

  // Fetch candidates for content enrichment
  const candidatesQuery = useQuery({
    queryKey: ["/api/content-enrichment/candidates"],
    enabled: activeTab === "candidates",
    refetchInterval: batchProgress.inProgress ? 3000 : 10000, // Refresh more frequently during batch processing
  });

  // Fetch recently enriched studies
  const recentlyEnrichedQuery = useQuery({
    queryKey: ["/api/content-enrichment/recent"],
    enabled: activeTab === "recent",
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Update status counts when candidate data changes
  useEffect(() => {
    if (candidatesQuery.data) {
      const studies = candidatesQuery.data as Study[];
      const counts = {
        total: studies.length,
        pending: studies.filter(s => !s.status || s.status === 'pending').length,
        processing: studies.filter(s => s.status === 'processing').length,
        success: studies.filter(s => s.status === 'success').length,
        failed: studies.filter(s => s.status === 'failed').length
      };
      setStatusCounts(counts);
    }
  }, [candidatesQuery.data]);

  // Handle select all checkbox changes
  useEffect(() => {
    if (candidatesQuery.data && selectAll) {
      const filteredStudies = getFilteredCandidates();
      setSelectedStudies(filteredStudies.map(study => study.id));
    } else if (!selectAll) {
      setSelectedStudies([]);
    }
  }, [selectAll, candidatesQuery.data, searchTerm, failedOnlyFilter]);

  // Mutation for enhancing a single study
  const enhanceStudyMutation = useMutation({
    mutationFn: async (studyId: number): Promise<EnrichmentResult> => {
      // Mark the study as processing in UI
      updateStudyStatus(studyId, 'processing');
      
      const response = await fetch(`/api/content-enrichment/study/${studyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        // Mark the study as failed in UI
        updateStudyStatus(studyId, 'failed', 'API request failed');
        throw new Error("Failed to enhance study");
      }
      
      const result = await response.json();
      
      // Mark the study as success/failed based on result
      updateStudyStatus(
        studyId, 
        result.success ? 'success' : 'failed', 
        result.success ? undefined : result.message
      );
      
      return result;
    },
    onSuccess: (data) => {
      // Show success message
      setProcessingStatus({
        message: `Successfully enhanced study #${data.studyId}. 
          ${Object.entries(data.updates || {})
            .filter(([_, value]) => value)
            .map(([key]) => key)
            .join(", ")} 
          updated.`,
        type: "success",
        visible: true,
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/content-enrichment/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-enrichment/recent"] });
    },
    onError: (error: Error, studyId: number) => {
      // Show error message and mark study as failed
      setProcessingStatus({
        message: `Error enhancing study #${studyId}: ${error.message}`,
        type: "error",
        visible: true,
      });
      
      // Mark the study as failed in UI
      updateStudyStatus(studyId, 'failed', error.message);
    },
  });

  // Mutation for batch enhancing studies
  const batchEnrichMutation = useMutation({
    mutationFn: async (studyIds: number[]): Promise<BatchResult> => {
      // Initialize batch progress
      setBatchProgress({
        inProgress: true,
        completed: 0,
        total: studyIds.length,
        successCount: 0,
        failureCount: 0
      });
      
      // Mark all studies as processing
      studyIds.forEach(id => updateStudyStatus(id, 'processing'));
      
      // Process studies in smaller batches to avoid overwhelming the server
      const batchSize = 5;
      const results: EnrichmentResult[] = [];
      let successCount = 0;
      let failureCount = 0;
      
      for (let i = 0; i < studyIds.length; i += batchSize) {
        const batch = studyIds.slice(i, i + batchSize);
        const batchPromises = batch.map(async (studyId) => {
          try {
            // For each study in the batch, process the study
            const response = await fetch(`/api/content-enrichment/study/${studyId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            
            if (!response.ok) {
              updateStudyStatus(studyId, 'failed', 'API request failed');
              failureCount++;
              return { success: false, studyId, message: 'API request failed' };
            }
            
            const result = await response.json();
            if (result.success) {
              updateStudyStatus(studyId, 'success');
              successCount++;
            } else {
              updateStudyStatus(studyId, 'failed', result.message);
              failureCount++;
            }
            
            return result;
          } catch (error) {
            updateStudyStatus(studyId, 'failed', error instanceof Error ? error.message : 'Unknown error');
            failureCount++;
            return { success: false, studyId, message: error instanceof Error ? error.message : 'Unknown error' };
          } finally {
            // Update batch progress
            setBatchProgress(prev => ({
              ...prev,
              completed: prev.completed + 1,
              successCount,
              failureCount
            }));
          }
        });
        
        // Process current batch and wait for completion
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Add a small delay between batches to avoid rate limiting
        if (i + batchSize < studyIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Compile final results
      return {
        message: `Batch process complete: ${results.length} studies processed`,
        processed: results.length,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        errors: results
          .filter(r => !r.success)
          .map(r => ({ studyId: r.studyId, error: r.message })),
        enhancedStudies: results
          .filter(r => r.success)
          .map(r => ({ id: r.studyId, title: '' })), // Title will be populated by refetching
      };
    },
    onSuccess: (data) => {
      // Show success message
      setProcessingStatus({
        message: `Batch process complete: ${data.processed} studies processed, 
          ${data.success} improved, ${data.failed} failed`,
        type: data.failed > data.success ? "error" : "success",
        visible: true,
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/content-enrichment/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-enrichment/recent"] });
      
      // Reset batch progress
      setBatchProgress({
        inProgress: false,
        completed: 0,
        total: 0,
        successCount: 0,
        failureCount: 0
      });
      
      // Clear selection
      setSelectedStudies([]);
      setSelectAll(false);
    },
    onError: (error) => {
      // Show error message
      setProcessingStatus({
        message: `Error in batch processing: ${error.message}`,
        type: "error",
        visible: true,
      });
      
      // Reset batch progress
      setBatchProgress({
        inProgress: false,
        completed: 0,
        total: 0,
        successCount: 0,
        failureCount: 0
      });
    },
  });

  // Process selected studies in a batch
  const processSelectedStudies = () => {
    if (selectedStudies.length === 0) {
      setProcessingStatus({
        message: "No studies selected. Please select at least one study to process.",
        type: "info",
        visible: true,
      });
      return;
    }
    
    batchEnrichMutation.mutate(selectedStudies);
  };

  // Process a single study
  const processSingleStudy = (studyId: number) => {
    enhanceStudyMutation.mutate(studyId);
  };

  // Retry failed studies
  const retryFailedStudies = () => {
    if (!candidatesQuery.data) return;
    
    const failedStudies = (candidatesQuery.data as Study[])
      .filter(study => study.status === 'failed')
      .map(study => study.id);
    
    if (failedStudies.length === 0) {
      setProcessingStatus({
        message: "No failed studies to retry.",
        type: "info",
        visible: true,
      });
      return;
    }
    
    batchEnrichMutation.mutate(failedStudies);
  };

  // Handle refreshing the data
  const refreshData = () => {
    if (activeTab === "candidates") {
      candidatesQuery.refetch();
    } else if (activeTab === "recent") {
      recentlyEnrichedQuery.refetch();
    }
  };

  // Handle closing the status alert
  const closeStatusAlert = () => {
    setProcessingStatus({ ...processingStatus, visible: false });
  };

  // Helper to update a study's status in the UI
  const updateStudyStatus = (
    studyId: number, 
    status: 'pending' | 'processing' | 'success' | 'failed',
    errorMessage?: string
  ) => {
    if (!candidatesQuery.data) return;
    
    const updatedData = (candidatesQuery.data as Study[]).map(study => 
      study.id === studyId 
        ? { ...study, status, errorMessage } 
        : study
    );
    
    queryClient.setQueryData(["/api/content-enrichment/candidates"], updatedData);
  };

  // Toggle selection of a study
  const toggleStudySelection = (studyId: number) => {
    setSelectedStudies(prev => 
      prev.includes(studyId) 
        ? prev.filter(id => id !== studyId) 
        : [...prev, studyId]
    );
  };

  // Toggle select all
  const toggleSelectAll = () => {
    setSelectAll(!selectAll);
  };

  // Filter candidates based on search term and failed only filter
  const getFilteredCandidates = (): Study[] => {
    if (!candidatesQuery.data) return [];
    
    const studies = candidatesQuery.data as Study[];
    
    return studies.filter(study => {
      // Apply search filter
      const matchesSearch = searchTerm === "" || 
        study.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        study.journal.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (study.doi && study.doi.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Apply failed only filter
      const matchesFailedFilter = !failedOnlyFilter || study.status === 'failed';
      
      return matchesSearch && matchesFailedFilter;
    });
  };

  // Get the filtered candidates
  const filteredCandidates = getFilteredCandidates();
  
  // Get recently enriched studies from the query
  const recentlyEnriched = Array.isArray(recentlyEnrichedQuery.data) ? recentlyEnrichedQuery.data : [];

  // Compute status counts for display
  const totalCandidates = candidatesQuery.data ? (candidatesQuery.data as Study[]).length : 0;
  const selectedCount = selectedStudies.length;

  // Status badge for each study
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'processing':
        return <Badge variant="outline" className="bg-yellow-50 border-yellow-200">
          <Clock className="h-3 w-3 mr-1 text-yellow-500" />
          Processing
        </Badge>;
      case 'success':
        return <Badge variant="outline" className="bg-green-50 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
          Enhanced
        </Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-50 border-red-200">
          <XCircle className="h-3 w-3 mr-1 text-red-500" />
          Failed
        </Badge>;
      default:
        return <Badge variant="outline">
          <Info className="h-3 w-3 mr-1 text-blue-500" />
          Pending
        </Badge>;
    }
  };

  return (
    <AdminLayout title="Content Enrichment" description="Select and enrich studies with full abstracts, methods, results, and images from external sources.">
      <div className="flex flex-col space-y-4">
        {/* Status Alert */}
        {processingStatus.visible && (
          <Alert variant={processingStatus.type === "error" ? "destructive" : "default"}>
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

        {/* Batch Progress */}
        {batchProgress.inProgress && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="flex flex-col space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Batch Processing Progress</span>
                  <span className="text-sm">{batchProgress.completed} of {batchProgress.total} completed</span>
                </div>
                <Progress value={(batchProgress.completed / batchProgress.total) * 100} />
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-green-600">Success: {batchProgress.successCount}</span>
                  <span className="text-red-600">Failed: {batchProgress.failureCount}</span>
                  <span>Remaining: {batchProgress.total - batchProgress.completed}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="candidates" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="candidates">
              Enrichment Candidates ({totalCandidates})
            </TabsTrigger>
            <TabsTrigger value="recent">
              Recently Enriched ({recentlyEnriched ? recentlyEnriched.length : 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="candidates">
            <Card>
              <CardHeader>
                <CardTitle>Select Studies to Enrich</CardTitle>
                <CardDescription>
                  Choose studies with incomplete content that can be enhanced with AI and external data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Status summary */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  <Card className="p-2 text-center">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">{statusCounts.total}</p>
                  </Card>
                  <Card className="p-2 text-center">
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-xl font-bold text-blue-600">{statusCounts.pending}</p>
                  </Card>
                  <Card className="p-2 text-center">
                    <p className="text-sm text-muted-foreground">Processing</p>
                    <p className="text-xl font-bold text-yellow-600">{statusCounts.processing}</p>
                  </Card>
                  <Card className="p-2 text-center">
                    <p className="text-sm text-muted-foreground">Successful</p>
                    <p className="text-xl font-bold text-green-600">{statusCounts.success}</p>
                  </Card>
                  <Card className="p-2 text-center">
                    <p className="text-sm text-muted-foreground">Failed</p>
                    <p className="text-xl font-bold text-red-600">{statusCounts.failed}</p>
                  </Card>
                </div>

                {/* Search and filter */}
                <div className="flex items-center justify-between mb-4 space-x-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by title, journal, or DOI..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 max-w-sm"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="failed-only"
                        checked={failedOnlyFilter}
                        onCheckedChange={() => setFailedOnlyFilter(!failedOnlyFilter)}
                      />
                      <label
                        htmlFor="failed-only"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Show Failed Only
                      </label>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refreshData}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Refresh
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={retryFailedStudies}
                      disabled={
                        batchProgress.inProgress ||
                        batchEnrichMutation.isPending ||
                        statusCounts.failed === 0
                      }
                    >
                      Retry Failed
                    </Button>
                    <Button
                      variant="default"
                      onClick={processSelectedStudies}
                      disabled={
                        batchProgress.inProgress ||
                        batchEnrichMutation.isPending ||
                        selectedStudies.length === 0
                      }
                    >
                      {batchEnrichMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        `Enrich Selected (${selectedCount})`
                      )}
                    </Button>
                  </div>
                </div>

                {candidatesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : candidatesQuery.isError ? (
                  <div className="text-center py-10 text-destructive">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>Failed to load candidate studies. Please try again.</p>
                  </div>
                ) : filteredCandidates.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <FilterX className="h-8 w-8 mx-auto mb-2" />
                    <p>No studies match your current filters.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={
                                filteredCandidates.length > 0 && 
                                selectedStudies.length === filteredCandidates.length
                              }
                              onCheckedChange={toggleSelectAll}
                              aria-label="Select all"
                            />
                          </TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Journal</TableHead>
                          <TableHead>Published</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCandidates.map((study: Study) => (
                          <TableRow 
                            key={study.id}
                            className={
                              study.status === 'processing' 
                                ? 'bg-yellow-50' 
                                : study.status === 'success' 
                                  ? 'bg-green-50' 
                                  : study.status === 'failed' 
                                    ? 'bg-red-50' 
                                    : ''
                            }
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedStudies.includes(study.id)}
                                onCheckedChange={() => toggleStudySelection(study.id)}
                                disabled={study.status === 'processing' || study.status === 'success'}
                                aria-label={`Select study ${study.id}`}
                              />
                            </TableCell>
                            <TableCell>{study.id}</TableCell>
                            <TableCell className="max-w-md truncate">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">{study.title}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-md">{study.title}</p>
                                  {study.doi && <p className="text-xs mt-1">DOI: {study.doi}</p>}
                                  {study.authors && <p className="text-xs mt-1">Authors: {study.authors}</p>}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>{study.journal}</TableCell>
                            <TableCell>{study.publishDate}</TableCell>
                            <TableCell>
                              {getStatusBadge(study.status)}
                              {study.status === 'failed' && study.errorMessage && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 ml-1 inline cursor-help text-red-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">{study.errorMessage}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant={study.status === 'failed' ? "destructive" : "outline"}
                                size="sm"
                                onClick={() => processSingleStudy(study.id)}
                                disabled={
                                  enhanceStudyMutation.isPending ||
                                  batchProgress.inProgress ||
                                  study.status === 'processing' ||
                                  study.status === 'success'
                                }
                              >
                                {study.status === 'failed' ? 'Retry' : 'Process'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Processing can take time depending on the availability of external data sources.
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {filteredCandidates.length} of {totalCandidates} studies shown
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <CardTitle>Recently Enriched Studies</CardTitle>
                <CardDescription>
                  Studies that have been successfully enriched with additional content.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentlyEnrichedQuery.isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : recentlyEnrichedQuery.isError ? (
                  <div className="text-center py-10 text-destructive">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>Failed to load recently enriched studies.</p>
                  </div>
                ) : recentlyEnriched.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <p>No recently enriched studies found.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Journal</TableHead>
                          <TableHead>Enhanced Fields</TableHead>
                          <TableHead>Published</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentlyEnriched.map((study: any) => (
                          <TableRow key={study.id}>
                            <TableCell>{study.id}</TableCell>
                            <TableCell className="max-w-md truncate">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">{study.title}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-md">{study.title}</p>
                                  {study.doi && <p className="text-xs mt-1">DOI: {study.doi}</p>}
                                  {study.authors && <p className="text-xs mt-1">Authors: {study.authors}</p>}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>{study.journal}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {study.enhancedFields && Array.isArray(study.enhancedFields) && study.enhancedFields.map((field: string) => (
                                  <Badge key={field} variant="outline" className="mr-1 bg-green-50 border-green-200">
                                    <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                                    {field}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>{study.publishDate}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  Studies shown here were enhanced in the last 7 days.
                </p>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}