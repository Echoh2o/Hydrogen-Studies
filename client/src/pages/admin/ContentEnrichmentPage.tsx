import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Database, FileText, RefreshCw, Check, X, Plus, Download, Image, BookOpen } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';

interface EnhancementResult {
  success: boolean;
  message: string;
  updates?: {
    abstract?: boolean;
    fullText?: boolean;
    images?: boolean;
    methods?: boolean;
    results?: boolean;
    conclusion?: boolean;
  };
  studyId?: number;
}

interface Study {
  id: number;
  title: string;
  abstract?: string;
  doi?: string;
  fullText?: string;
  imageUrl?: string;
}

const ContentEnrichmentPage: React.FC = () => {
  const [studyId, setStudyId] = useState<string>('');
  const [selectedStudies, setSelectedStudies] = useState<number[]>([]);
  const [processingIds, setProcessingIds] = useState<number[]>([]);
  const [enhancementResults, setEnhancementResults] = useState<EnhancementResult[]>([]);
  const queryClient = useQueryClient();

  // Fetch studies that might need enrichment
  const { data: studies, isLoading: studiesLoading } = useQuery<Study[]>({
    queryKey: ['/api/admin/studies/incomplete'],
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to fetch studies for enhancement',
        variant: 'destructive',
      });
    }
  });

  // Single study enhancement mutation
  const enhanceMutation = useMutation<EnhancementResult, Error, number>({
    mutationFn: async (id: number) => {
      setProcessingIds(prev => [...prev, id]);
      try {
        const response = await fetch(`/api/admin/enhance-study/${id}`, {
          method: 'POST',
        });
        
        if (!response.ok) {
          throw new Error(`Failed to enhance study: ${response.statusText}`);
        }
        
        return await response.json();
      } finally {
        setProcessingIds(prev => prev.filter(pid => pid !== id));
      }
    },
    onSuccess: (data) => {
      setEnhancementResults(prev => [data, ...prev]);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/studies/incomplete'] });
      toast({
        title: data.success ? 'Success' : 'Warning',
        description: data.message,
        variant: data.success ? 'default' : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Enhancement failed: ${error.message}`,
        variant: 'destructive',
      });
    }
  });

  // Batch enhancement mutation
  const batchEnhanceMutation = useMutation<{overall: boolean, results: EnhancementResult[]}, Error, number[]>({
    mutationFn: async (ids: number[]) => {
      setProcessingIds(ids);
      try {
        const response = await fetch('/api/admin/enhance-studies/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ studyIds: ids }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to batch enhance studies: ${response.statusText}`);
        }
        
        return await response.json();
      } finally {
        setProcessingIds([]);
      }
    },
    onSuccess: (data) => {
      setEnhancementResults(data.results);
      setSelectedStudies([]);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/studies/incomplete'] });
      toast({
        title: data.overall ? 'Batch Enhancement Complete' : 'Batch Enhancement Completed with Issues',
        description: `Processed ${data.results.length} studies with ${data.results.filter(r => r.success).length} successes`,
        variant: data.overall ? 'default' : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: 'Batch Enhancement Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handleSingleEnhancement = () => {
    const id = parseInt(studyId);
    if (!isNaN(id)) {
      enhanceMutation.mutate(id);
      setStudyId('');
    } else {
      toast({
        title: 'Invalid Study ID',
        description: 'Please enter a valid study ID',
        variant: 'destructive',
      });
    }
  };

  const handleBatchEnhancement = () => {
    if (selectedStudies.length > 0) {
      batchEnhanceMutation.mutate(selectedStudies);
    } else {
      toast({
        title: 'No Studies Selected',
        description: 'Please select at least one study for enhancement',
        variant: 'destructive',
      });
    }
  };

  const toggleStudySelection = (id: number) => {
    setSelectedStudies(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const toggleAllStudies = () => {
    if (!studies) return;
    
    if (selectedStudies.length === studies.length) {
      setSelectedStudies([]);
    } else {
      setSelectedStudies(studies.map(s => s.id));
    }
  };

  return (
    <AdminLayout>
      <div className="container px-4 py-6 mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" asChild className="mr-2">
              <Link href="/admin/research-database">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Research Database
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Content Enrichment Tool</h1>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Enhance Study Content</CardTitle>
              <CardDescription>
                This tool fetches full abstracts, text, and images from DOI sources to enhance our study database.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="single" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="single">Single Study</TabsTrigger>
                  <TabsTrigger value="batch">Batch Enhancement</TabsTrigger>
                </TabsList>
                
                <TabsContent value="single">
                  <div className="flex items-end gap-4">
                    <div className="w-full">
                      <Label htmlFor="studyId">Study ID</Label>
                      <Input
                        id="studyId"
                        placeholder="Enter study ID"
                        value={studyId}
                        onChange={(e) => setStudyId(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleSingleEnhancement}
                      disabled={!studyId || enhanceMutation.isPending}
                    >
                      {enhanceMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Enhance Content
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="batch">
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-medium">Studies for Enhancement</h3>
                      <Button
                        variant="outline" 
                        size="sm"
                        onClick={toggleAllStudies}
                        disabled={!studies || studies.length === 0}
                      >
                        {selectedStudies.length === (studies?.length || 0) 
                          ? "Deselect All" 
                          : "Select All"}
                      </Button>
                    </div>
                    
                    {studiesLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : studies && studies.length > 0 ? (
                      <ScrollArea className="h-64 rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12"></TableHead>
                              <TableHead>ID</TableHead>
                              <TableHead>Title</TableHead>
                              <TableHead>DOI</TableHead>
                              <TableHead>Has Abstract</TableHead>
                              <TableHead>Has Image</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {studies.map((study) => (
                              <TableRow key={study.id} className={
                                processingIds.includes(study.id) ? "bg-primary/10" : ""
                              }>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedStudies.includes(study.id)}
                                    onCheckedChange={() => toggleStudySelection(study.id)}
                                    disabled={processingIds.includes(study.id)}
                                  />
                                </TableCell>
                                <TableCell>{study.id}</TableCell>
                                <TableCell className="max-w-xs truncate">{study.title}</TableCell>
                                <TableCell>{study.doi || "—"}</TableCell>
                                <TableCell>
                                  {study.abstract && study.abstract.length > 100 ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <X className="h-4 w-4 text-red-500" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  {study.imageUrl ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <X className="h-4 w-4 text-red-500" />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    ) : (
                      <div className="text-center py-8 border rounded-md bg-muted/20">
                        <p>No studies found that need enhancement</p>
                      </div>
                    )}
                    
                    <div className="mt-4 flex justify-end">
                      <Button
                        onClick={handleBatchEnhancement}
                        disabled={selectedStudies.length === 0 || batchEnhanceMutation.isPending}
                      >
                        {batchEnhanceMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing Batch...
                          </>
                        ) : (
                          <>
                            <Database className="mr-2 h-4 w-4" />
                            Process Selected ({selectedStudies.length})
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Enhancement Results</CardTitle>
              <CardDescription>
                Recent content enrichment results and updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {enhancementResults.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Study ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updates</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enhancementResults.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell>{result.studyId || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={result.success ? "success" : "destructive"}>
                            {result.success ? "Success" : "Failed"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {result.updates?.abstract && (
                              <Badge variant="outline" className="bg-blue-50">
                                <FileText className="h-3 w-3 mr-1" />
                                Abstract
                              </Badge>
                            )}
                            {result.updates?.fullText && (
                              <Badge variant="outline" className="bg-green-50">
                                <BookOpen className="h-3 w-3 mr-1" />
                                Full Text
                              </Badge>
                            )}
                            {result.updates?.images && (
                              <Badge variant="outline" className="bg-purple-50">
                                <Image className="h-3 w-3 mr-1" />
                                Images
                              </Badge>
                            )}
                            {result.updates?.methods && (
                              <Badge variant="outline" className="bg-amber-50">
                                Methods
                              </Badge>
                            )}
                            {result.updates?.results && (
                              <Badge variant="outline" className="bg-cyan-50">
                                Results
                              </Badge>
                            )}
                            {result.updates?.conclusion && (
                              <Badge variant="outline" className="bg-indigo-50">
                                Conclusion
                              </Badge>
                            )}
                            {!result.updates && (
                              <span className="text-muted-foreground text-sm">None</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{result.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 border rounded-md bg-muted/20">
                  <p>No enhancement results yet</p>
                  <p className="text-sm text-muted-foreground">
                    Use the tools above to enhance study content
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default ContentEnrichmentPage;