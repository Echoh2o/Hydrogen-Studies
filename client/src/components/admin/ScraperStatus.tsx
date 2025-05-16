import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Interface for scraper status response
interface ScraperProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  startTime: string;
  lastUpdateTime: string;
  isRunning: boolean;
  estimatedTimeRemaining: number;
  error?: string;
  source: string;
}

interface ScraperStatusResponse {
  success: boolean;
  status: ScraperProgress;
  description: string;
  message?: string;
}

export const ScraperStatus = () => {
  const [refreshInterval, setRefreshInterval] = useState<number | false>(5000);
  
  const { 
    data, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useQuery<ScraperStatusResponse>({
    queryKey: ['/api/scraper/status'],
    refetchInterval: refreshInterval,
  });
  
  // Automatically stop polling when scraper is not running
  useEffect(() => {
    if (data?.status && !data.status.isRunning) {
      setRefreshInterval(false);
    }
  }, [data]);
  
  const handleStartScraper = async () => {
    try {
      const response = await fetch('/api/scraper/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Start polling for updates
        setRefreshInterval(5000);
        refetch();
      }
    } catch (error) {
      console.error('Error starting scraper:', error);
    }
  };
  
  const handleRefresh = () => {
    refetch();
  };
  
  // Format remaining time in a human-readable format
  const formatRemainingTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
    }
  };
  
  // Calculate progress percentage
  const calculateProgress = () => {
    if (!data?.status) return 0;
    const { total, processed } = data.status;
    if (total === 0) return 0;
    return Math.round((processed / total) * 100);
  };
  
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Scraper Status</CardTitle>
          <CardDescription>Loading status information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (isError) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Scraper Status</CardTitle>
          <CardDescription>Error retrieving status</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'Failed to load scraper status'}
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  const { status } = data!;
  const progressValue = calculateProgress();
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Scraper Status</CardTitle>
        <CardDescription>
          {status.source ? `Source: ${status.source}` : 'Website scraper status'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status description */}
        <div className="font-medium">{data.description}</div>
        
        {/* Progress bar */}
        {status.isRunning && status.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress: {status.processed} of {status.total}</span>
              <span>{progressValue}%</span>
            </div>
            <Progress value={progressValue} className="h-2" />
          </div>
        )}
        
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="rounded-lg border p-3">
            <div className="text-sm text-muted-foreground">Successful</div>
            <div className="text-2xl font-bold text-green-600">{status.successful}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-sm text-muted-foreground">Failed</div>
            <div className="text-2xl font-bold text-red-600">{status.failed}</div>
          </div>
        </div>
        
        {/* Time information */}
        {status.isRunning && status.estimatedTimeRemaining > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Estimated time remaining: {formatRemainingTime(status.estimatedTimeRemaining)}</span>
          </div>
        )}
        
        {/* Error message */}
        {status.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{status.error}</AlertDescription>
          </Alert>
        )}
        
        {/* Success message */}
        {!status.isRunning && status.successful > 0 && !status.error && (
          <Alert variant="success" className="bg-green-50 text-green-800 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
              Successfully imported {status.successful} studies
              {status.failed > 0 ? ` (${status.failed} failed)` : ''}.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          size="sm"
          disabled={status.isRunning && refreshInterval !== false}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        
        <Button 
          onClick={handleStartScraper} 
          disabled={status.isRunning}
          size="sm"
        >
          {status.isRunning ? 'Running...' : 'Start Scraper'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ScraperStatus;