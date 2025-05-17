import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowUpCircle, Calendar, Clock, Database, FileSpreadsheet, RotateCw, ThumbsUp } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';

interface JournalDateUpdaterProps {}

interface JournalDateStats {
  totalStudies: number;
  studiesWithDate: number;
  studiesNeedingDate: number;
  percentComplete: number;
  recentlyUpdated: any[];
}

const JournalDateUpdater: React.FC<JournalDateUpdaterProps> = () => {
  const [limit, setLimit] = useState<number>(50);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [progress, setProgress] = useState<number>(0);
  const { toast } = useToast();
  
  // Fetch journal date statistics
  const { 
    data: statsData,
    isLoading: isLoadingStats,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['/api/admin/journal-date-stats']
  });

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setLimit(value);
    }
  };

  // Trigger update when finished processing
  useEffect(() => {
    if (!isProcessing && result?.success) {
      refetchStats();
    }
  }, [isProcessing, result, refetchStats]);

  const processJournalDates = async () => {
    try {
      setIsProcessing(true);
      setProgress(10);
      setResult(null);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + 5;
          return newProgress >= 90 ? 90 : newProgress;
        });
      }, 1000);

      const response = await apiRequest('/api/admin/update-journal-dates', {
        method: 'POST',
        body: { limit },
      });

      clearInterval(progressInterval);
      setProgress(100);
      setResult(response);

      if (response.success) {
        toast({
          title: 'Journal Dates Updated',
          description: `Successfully updated ${response.totalUpdated} studies.`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Error',
          description: response.message || 'Failed to update journal dates',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating journal dates:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while updating journal dates',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Journal Publication Date Updater</h1>
      
      <div className="grid gap-6">
        {/* Statistics Dashboard */}
        <Card>
          <CardHeader>
            <CardTitle>Database Statistics</CardTitle>
            <CardDescription>
              Overview of journal publication date completeness in the database
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <div className="flex justify-center items-center p-6">
                <RotateCw className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : statsData?.stats ? (
              <div className="grid md:grid-cols-3 gap-4">
                {/* Stats Summary */}
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-medium">Total Studies</h3>
                    </div>
                    <p className="text-3xl font-bold mt-2">{statsData.stats.totalStudies.toLocaleString()}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium">Has Journal Date</h3>
                      <p className="text-2xl font-bold mt-2">{statsData.stats.studiesWithDate.toLocaleString()}</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium">Needs Journal Date</h3>
                      <p className="text-2xl font-bold mt-2">{statsData.stats.studiesNeedingDate.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                
                {/* Completion Progress */}
                <div className="md:col-span-2 bg-slate-50 p-4 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <h3 className="text-lg font-medium">Completion Progress</h3>
                      <span className="text-lg font-bold">{statsData.stats.percentComplete}%</span>
                    </div>
                    <Progress value={statsData.stats.percentComplete} className="h-4" />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                  
                  {/* Recently Updated */}
                  <div className="mt-6">
                    <h3 className="text-md font-medium mb-2">Recently Updated Studies</h3>
                    <div className="text-sm">
                      {statsData.stats.recentlyUpdated.length > 0 ? (
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {statsData.stats.recentlyUpdated.map((study: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 p-2 bg-white rounded border">
                              <Calendar className="h-4 w-4 text-primary mt-0.5" />
                              <div>
                                <p className="font-medium line-clamp-1">{study.title}</p>
                                <div className="flex gap-2 text-xs text-muted-foreground">
                                  <span>Journal: {study.journalPublishDate}</span>
                                  <span>DOI: {study.doi || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">No recent updates</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Alert variant="destructive">
                <p>Could not load statistics</p>
              </Alert>
            )}
          </CardContent>
        </Card>
        
        {/* Update Tool */}
        <Card>
          <CardHeader>
            <CardTitle>Update Journal Publication Dates</CardTitle>
            <CardDescription>
              This tool updates the original journal publication dates for studies in the database.
              It uses a combination of CrossRef, EuropePMC, and DOI.org APIs to find accurate
              publication dates for studies that have DOIs but missing journal dates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="limit" className="text-right">
                  Max Studies
                </Label>
                <Input
                  id="limit"
                  type="number"
                  value={limit}
                  onChange={handleLimitChange}
                  min={1}
                  max={100}
                  className="col-span-3"
                  disabled={isProcessing}
                />
              </div>
              
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center">
                    <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                    <span>Processing journal dates...</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              )}
              
              {result && (
                <Alert className={result.success ? 'bg-green-50' : 'bg-red-50'}>
                  {result.success ? (
                    <ThumbsUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <ArrowUpCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertTitle>
                    {result.success ? 'Update Successful' : 'Update Failed'}
                  </AlertTitle>
                  <AlertDescription>
                    {result.message}
                    {result.success && result.failedDois?.length > 0 && (
                      <div className="mt-2">
                        <p>Failed DOIs: {result.failedDois.length}</p>
                        <div className="mt-1 text-xs max-h-20 overflow-y-auto">
                          {result.failedDois.map((doi: string, index: number) => (
                            <div key={index} className="text-slate-500">
                              {doi}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="mr-1 h-4 w-4" />
              <span>This process can take several minutes for large updates</span>
            </div>
            <Button onClick={processJournalDates} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : 'Update Journal Dates'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default JournalDateUpdater;