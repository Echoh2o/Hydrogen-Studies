import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, AlertCircle, CheckCircle2, DatabaseIcon, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { apiRequest } from '@/lib/queryClient';
import { Study } from '@shared/schema';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

export default function ContentEnrichmentPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState('candidates');
  const [processingStatus, setProcessingStatus] = useState<{
    total: number;
    processed: number;
    success: number;
    failed: number;
  }>({ total: 0, processed: 0, success: 0, failed: 0 });

  // Fetch studies that need content enrichment
  const { data: candidateStudies, isLoading: loadingCandidates, refetch: refetchCandidates } = useQuery({
    queryKey: ['/api/content-enrichment/candidates'],
    refetchOnWindowFocus: false
  });

  // Fetch recently processed studies
  const { data: recentlyProcessed, isLoading: loadingRecent, refetch: refetchRecent } = useQuery({
    queryKey: ['/api/content-enrichment/recent'],
    refetchOnWindowFocus: false
  });

  // Mutation for enriching a single study
  const { mutate: enrichStudy, isPending: isEnriching } = useMutation({
    mutationFn: async (studyId: number) => {
      return apiRequest(`/api/content-enrichment/study/${studyId}`, {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Study enriched successfully',
        description: `Updated ${Object.entries(data.updates || {})
          .filter(([_, value]) => value)
          .map(([key]) => key)
          .join(', ')}`,
        variant: 'default'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/content-enrichment/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/content-enrichment/recent'] });
      queryClient.invalidateQueries({ queryKey: [`/api/studies/${data.studyId}`] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to enrich study',
        description: 'There was an error while trying to enrich the study content.',
        variant: 'destructive'
      });
    }
  });

  // Mutation for batch enrichment of studies
  const { mutate: batchEnrich, isPending: isBatchProcessing } = useMutation({
    mutationFn: async (count: number) => {
      // Reset status
      setProcessingStatus({ total: count, processed: 0, success: 0, failed: 0 });
      
      return apiRequest('/api/content-enrichment/batch', {
        method: 'POST',
        body: { count }
      });
    },
    onSuccess: (data) => {
      setProcessingStatus(prev => ({
        ...prev,
        processed: data.processed,
        success: data.success,
        failed: data.failed
      }));
      
      toast({
        title: 'Batch enrichment completed',
        description: `Successfully enhanced ${data.success} studies out of ${data.processed}`,
        variant: 'default'
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/content-enrichment/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/content-enrichment/recent'] });
    },
    onError: (error) => {
      toast({
        title: 'Batch enrichment failed',
        description: 'There was an error while processing the batch of studies.',
        variant: 'destructive'
      });
    }
  });

  // Handle single study enrichment
  const handleEnrichStudy = (studyId: number) => {
    enrichStudy(studyId);
  };

  // Handle batch enrichment
  const handleBatchEnrich = (count: number) => {
    batchEnrich(count);
  };

  // Calculate progress percentage
  const progressPercentage = processingStatus.total > 0
    ? Math.round((processingStatus.processed / processingStatus.total) * 100)
    : 0;

  return (
    <AdminLayout title="Content Enrichment">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content Enrichment</h1>
          <p className="text-muted-foreground mt-2">
            Enhance studies with truncated abstracts, missing methods, results, or conclusions by fetching data from multiple research APIs.
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Enrichment Dashboard</CardTitle>
              <CardDescription>
                Monitor content enrichment progress and statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-base flex items-center">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Pending Enrichment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="text-3xl font-bold">
                      {loadingCandidates ? (
                        <Skeleton className="h-8 w-20" />
                      ) : (
                        candidateStudies?.length || 0
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Studies with DOIs but incomplete abstract data
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-base flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Recently Enhanced
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="text-3xl font-bold">
                      {loadingRecent ? (
                        <Skeleton className="h-8 w-20" />
                      ) : (
                        recentlyProcessed?.length || 0
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Studies successfully processed recently
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-base flex items-center">
                      <DatabaseIcon className="mr-2 h-4 w-4" />
                      Data Sources
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge>CrossRef</Badge>
                      <Badge>EuropePMC</Badge>
                      <Badge>Semantic Scholar</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Multiple sources for enhanced data completeness
                    </p>
                  </CardContent>
                </Card>
              </div>

              {isBatchProcessing && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">
                      Processing batch: {processingStatus.processed} of {processingStatus.total}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {progressPercentage}%
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>Success: {processingStatus.success}</span>
                    <span>Failed: {processingStatus.failed}</span>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/50 py-4">
              <div className="flex flex-col sm:flex-row gap-2 w-full justify-between">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      refetchCandidates();
                      refetchRecent();
                    }}
                    disabled={loadingCandidates || loadingRecent}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Stats
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleBatchEnrich(5)} 
                    disabled={isBatchProcessing || isEnriching}
                    variant="outline"
                  >
                    Process 5
                  </Button>
                  <Button 
                    onClick={() => handleBatchEnrich(20)} 
                    disabled={isBatchProcessing || isEnriching}
                  >
                    Process 20
                  </Button>
                </div>
              </div>
            </CardFooter>
          </Card>

          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full md:w-auto grid-cols-2">
              <TabsTrigger value="candidates">Enrichment Candidates</TabsTrigger>
              <TabsTrigger value="recent">Recently Enhanced</TabsTrigger>
            </TabsList>
            
            <TabsContent value="candidates" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Search className="mr-2 h-5 w-5" />
                    Studies Needing Enhancement
                  </CardTitle>
                  <CardDescription>
                    Studies with DOIs that have incomplete abstracts or missing data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingCandidates ? (
                    <div className="space-y-4">
                      {Array(5).fill(0).map((_, index) => (
                        <div key={index} className="flex flex-col space-y-2">
                          <Skeleton className="h-6 w-1/3" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                      ))}
                    </div>
                  ) : candidateStudies?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium">No studies need enrichment</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        All studies with DOIs have complete abstract data
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Study Title</TableHead>
                            <TableHead>DOI</TableHead>
                            <TableHead>Abstract Length</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {candidateStudies?.map((study: Study) => (
                            <TableRow key={study.id}>
                              <TableCell className="font-medium">{study.title}</TableCell>
                              <TableCell>{study.doi}</TableCell>
                              <TableCell>
                                {study.abstract ? study.abstract.length : 0} chars
                                {(!study.abstract || study.abstract.length < 100) && (
                                  <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-200">
                                    Truncated
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  onClick={() => handleEnrichStudy(study.id)}
                                  disabled={isEnriching || isBatchProcessing}
                                >
                                  Enrich
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="recent" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Recently Enhanced Studies
                  </CardTitle>
                  <CardDescription>
                    Studies that have been successfully enhanced with additional content
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingRecent ? (
                    <div className="space-y-4">
                      {Array(5).fill(0).map((_, index) => (
                        <div key={index} className="flex flex-col space-y-2">
                          <Skeleton className="h-6 w-1/3" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                      ))}
                    </div>
                  ) : recentlyProcessed?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium">No recently enhanced studies</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Use the batch process or individual enrich buttons to enhance studies
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Study Title</TableHead>
                            <TableHead>DOI</TableHead>
                            <TableHead>Enhanced Fields</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentlyProcessed?.map((study: any) => (
                            <TableRow key={study.id}>
                              <TableCell className="font-medium">{study.title}</TableCell>
                              <TableCell>{study.doi}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {study.enhancedFields?.map((field: string) => (
                                    <Badge key={field} variant={field === 'abstract' ? 'success' : 'default'}>
                                      {field}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleEnrichStudy(study.id)}
                                  disabled={isEnriching || isBatchProcessing}
                                >
                                  Re-Enrich
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminLayout>
  );
}