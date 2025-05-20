import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminLayout from '@/components/layout/AdminLayout';
import { Loader2, CheckCircle2, AlertCircle, BarChart3 } from 'lucide-react';

interface CategoryStats {
  condition: Record<string, number>;
  bodySystem: Record<string, number>;
  lifeStage: Record<string, number>;
}

interface ContentGapStats {
  totalStudies: number;
  missingMethods: number;
  missingResults: number;
  missingConclusion: number;
  missingAbstract: number;
  missingImages: number;
  missingSimplifiedExplanation: number;
}

const BatchCategorizationPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [batchSize, setBatchSize] = useState<number>(10);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingResults, setProcessingResults] = useState<any>(null);
  const [activePriority, setActivePriority] = useState<string>('');
  
  // Fetch available consumer categories
  const { data: categoriesData, isLoading: loadingCategories } = useQuery({
    queryKey: ['/api/consumer-categories'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Fetch current content gap statistics
  const { data: gapStats, isLoading: loadingGapStats, refetch: refetchGapStats } = useQuery({
    queryKey: ['/api/enrichment/statistics'],
    staleTime: 1000 * 60, // 1 minute
  });
  
  // Fetch category counts
  const { data: categoryCountsData, isLoading: loadingCounts, refetch: refetchCounts } = useQuery({
    queryKey: ['/api/consumer-categories/counts'],
    staleTime: 1000 * 60, // 1 minute
  });
  
  // Mutation for batch processing
  const batchProcessMutation = useMutation({
    mutationFn: async (data: { limit: number }) => {
      return apiRequest('/api/studies/batch-categorize-consumer', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/consumer-categories/counts'] });
    },
  });
  
  // Mutation for priority content enrichment
  const priorityEnrichmentMutation = useMutation({
    mutationFn: async (data: { priorityType?: string, batchSize: number, maxStudies: number }) => {
      return apiRequest('/api/enrichment/priority/start', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enrichment/statistics'] });
    },
  });
  
  // Handle batch categorization
  const handleBatchCategorization = async () => {
    try {
      setIsProcessing(true);
      setProcessingResults(null);
      
      const response = await batchProcessMutation.mutateAsync({ 
        limit: batchSize 
      });
      
      setProcessingResults(response.data);
      await refetchCounts();
    } catch (error) {
      console.error('Error in batch categorization:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle priority enrichment
  const handlePriorityEnrichment = async (priorityType?: string) => {
    try {
      setIsProcessing(true);
      setProcessingResults(null);
      setActivePriority(priorityType || 'auto');
      
      const response = await priorityEnrichmentMutation.mutateAsync({
        priorityType,
        batchSize: 5,
        maxStudies: 20
      });
      
      setProcessingResults(response.data);
      await refetchGapStats();
    } catch (error) {
      console.error('Error in priority enrichment:', error);
    } finally {
      setIsProcessing(false);
      setActivePriority('');
    }
  };
  
  // Calculate percentage for each gap
  const calculatePercentage = (count: number, total: number) => {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  };
  
  // Get content gap statistics
  const getContentGaps = (): ContentGapStats => {
    if (!gapStats?.data) {
      return {
        totalStudies: 0,
        missingMethods: 0,
        missingResults: 0,
        missingConclusion: 0,
        missingAbstract: 0,
        missingImages: 0,
        missingSimplifiedExplanation: 0
      };
    }
    
    return gapStats.data;
  };
  
  const contentGaps = getContentGaps();
  
  return (
    <AdminLayout>
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Batch Content Management</h1>
        
        <Tabs defaultValue="categorization" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="categorization">Consumer Categorization</TabsTrigger>
            <TabsTrigger value="enrichment">Priority Content Enrichment</TabsTrigger>
          </TabsList>
          
          {/* Consumer Categorization Tab */}
          <TabsContent value="categorization" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Condition Categories</CardTitle>
                  <CardDescription>Health condition focus</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingCounts ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {categoryCountsData?.data?.condition && 
                        Object.entries(categoryCountsData.data.condition)
                          .sort(([, countA], [, countB]) => (countB as number) - (countA as number))
                          .map(([category, count]) => (
                            <div key={category} className="flex justify-between items-center">
                              <span className="text-sm">{category}</span>
                              <span className="text-sm font-medium">{count}</span>
                            </div>
                          ))
                      }
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Body System Categories</CardTitle>
                  <CardDescription>Physiological focus</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingCounts ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {categoryCountsData?.data?.bodySystem && 
                        Object.entries(categoryCountsData.data.bodySystem)
                          .sort(([, countA], [, countB]) => (countB as number) - (countA as number))
                          .map(([category, count]) => (
                            <div key={category} className="flex justify-between items-center">
                              <span className="text-sm">{category}</span>
                              <span className="text-sm font-medium">{count}</span>
                            </div>
                          ))
                      }
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Life Stage Categories</CardTitle>
                  <CardDescription>Demographic focus</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingCounts ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {categoryCountsData?.data?.lifeStage && 
                        Object.entries(categoryCountsData.data.lifeStage)
                          .sort(([, countA], [, countB]) => (countB as number) - (countA as number))
                          .map(([category, count]) => (
                            <div key={category} className="flex justify-between items-center">
                              <span className="text-sm">{category}</span>
                              <span className="text-sm font-medium">{count}</span>
                            </div>
                          ))
                      }
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Batch Categorization</CardTitle>
                <CardDescription>
                  Process studies in batches to apply consumer-friendly categorization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="batchSize">Batch Size</Label>
                      <Input 
                        id="batchSize" 
                        type="number" 
                        value={batchSize}
                        onChange={(e) => setBatchSize(parseInt(e.target.value))}
                        min={1}
                        max={50}
                      />
                    </div>
                  </div>
                  
                  {processingResults && (
                    <Alert className={`mt-4 ${
                      processingResults.success > 0 ? 'bg-green-50' : 'bg-amber-50'
                    }`}>
                      <div className="flex items-start">
                        <div className="mr-2 mt-0.5">
                          {processingResults.success > 0 ? 
                            <CheckCircle2 className="h-5 w-5 text-green-500" /> : 
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                          }
                        </div>
                        <div>
                          <AlertTitle>Processing Results</AlertTitle>
                          <AlertDescription>
                            <div className="mt-2 space-y-1">
                              <div>Total studies processed: {processingResults.total}</div>
                              <div>Successfully categorized: {processingResults.success}</div>
                              <div>Failed: {processingResults.failed}</div>
                              {processingResults.errors && processingResults.errors.length > 0 && (
                                <div className="mt-2">
                                  <div className="font-medium">Errors:</div>
                                  <ul className="list-disc pl-5 mt-1 text-sm">
                                    {processingResults.errors.slice(0, 3).map((err: any, idx: number) => (
                                      <li key={idx}>Study #{err.studyId}: {err.error}</li>
                                    ))}
                                    {processingResults.errors.length > 3 && (
                                      <li>...and {processingResults.errors.length - 3} more errors</li>
                                    )}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </AlertDescription>
                        </div>
                      </div>
                    </Alert>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleBatchCategorization}
                  disabled={isProcessing}
                  className="w-full md:w-auto"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Process Next Batch'
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          {/* Priority Content Enrichment Tab */}
          <TabsContent value="enrichment" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  Content Gap Analysis
                </CardTitle>
                <CardDescription>
                  Current data quality statistics for study content
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingGapStats ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div className="text-sm font-medium">Missing Methods</div>
                          <div className="text-sm text-muted-foreground">
                            {contentGaps.missingMethods} studies ({calculatePercentage(contentGaps.missingMethods, contentGaps.totalStudies)}%)
                          </div>
                        </div>
                        <Progress value={calculatePercentage(contentGaps.missingMethods, contentGaps.totalStudies)} className="h-2" />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div className="text-sm font-medium">Missing Results</div>
                          <div className="text-sm text-muted-foreground">
                            {contentGaps.missingResults} studies ({calculatePercentage(contentGaps.missingResults, contentGaps.totalStudies)}%)
                          </div>
                        </div>
                        <Progress value={calculatePercentage(contentGaps.missingResults, contentGaps.totalStudies)} className="h-2" />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div className="text-sm font-medium">Missing Conclusion</div>
                          <div className="text-sm text-muted-foreground">
                            {contentGaps.missingConclusion} studies ({calculatePercentage(contentGaps.missingConclusion, contentGaps.totalStudies)}%)
                          </div>
                        </div>
                        <Progress value={calculatePercentage(contentGaps.missingConclusion, contentGaps.totalStudies)} className="h-2" />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div className="text-sm font-medium">Missing Images</div>
                          <div className="text-sm text-muted-foreground">
                            {contentGaps.missingImages} studies ({calculatePercentage(contentGaps.missingImages, contentGaps.totalStudies)}%)
                          </div>
                        </div>
                        <Progress value={calculatePercentage(contentGaps.missingImages, contentGaps.totalStudies)} className="h-2" />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div className="text-sm font-medium">Missing Abstract</div>
                          <div className="text-sm text-muted-foreground">
                            {contentGaps.missingAbstract} studies ({calculatePercentage(contentGaps.missingAbstract, contentGaps.totalStudies)}%)
                          </div>
                        </div>
                        <Progress value={calculatePercentage(contentGaps.missingAbstract, contentGaps.totalStudies)} className="h-2" />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div className="text-sm font-medium">Missing Simplified Explanations</div>
                          <div className="text-sm text-muted-foreground">
                            {contentGaps.missingSimplifiedExplanation} studies ({calculatePercentage(contentGaps.missingSimplifiedExplanation, contentGaps.totalStudies)}%)
                          </div>
                        </div>
                        <Progress value={calculatePercentage(contentGaps.missingSimplifiedExplanation, contentGaps.totalStudies)} className="h-2" />
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground text-center">
                      Total studies: <span className="font-medium">{contentGaps.totalStudies}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Priority-Based Content Enrichment</CardTitle>
                <CardDescription>
                  Automatically focus on the most critical content gaps first
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => handlePriorityEnrichment()}
                    disabled={isProcessing}
                    className={activePriority === 'auto' ? 'border-primary' : ''}
                  >
                    Auto-Prioritize
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handlePriorityEnrichment('methods')}
                    disabled={isProcessing}
                    className={activePriority === 'methods' ? 'border-primary' : ''}
                  >
                    Missing Methods
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handlePriorityEnrichment('results')}
                    disabled={isProcessing}
                    className={activePriority === 'results' ? 'border-primary' : ''}
                  >
                    Missing Results
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handlePriorityEnrichment('conclusion')}
                    disabled={isProcessing}
                    className={activePriority === 'conclusion' ? 'border-primary' : ''}
                  >
                    Missing Conclusions
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handlePriorityEnrichment('images')}
                    disabled={isProcessing}
                    className={activePriority === 'images' ? 'border-primary' : ''}
                  >
                    Missing Images
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handlePriorityEnrichment('simplified_explanation')}
                    disabled={isProcessing}
                    className={activePriority === 'simplified_explanation' ? 'border-primary' : ''}
                  >
                    Missing Explanations
                  </Button>
                </div>
                
                {isProcessing && (
                  <div className="flex items-center justify-center mt-6 py-6">
                    <div className="text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin mb-2" />
                      <div className="text-sm font-medium">Processing priority batch...</div>
                      <div className="text-xs text-muted-foreground mt-1">This may take a few minutes.</div>
                    </div>
                  </div>
                )}
                
                {processingResults && (
                  <Alert className="mt-6 bg-blue-50">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                      <div>
                        <AlertTitle>Priority Enrichment Started</AlertTitle>
                        <AlertDescription>
                          <div className="mt-2 space-y-1">
                            <div>Total studies to process: {processingResults.total}</div>
                            <div>Current priority: {processingResults.currentPriority}</div>
                            <div>Current progress: {processingResults.processed}/{processingResults.total}</div>
                            <div className="mt-2">
                              <Progress 
                                value={processingResults.total > 0 ? 
                                  (processingResults.processed / processingResults.total) * 100 : 0
                                } 
                                className="h-2" 
                              />
                            </div>
                          </div>
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default BatchCategorizationPage;