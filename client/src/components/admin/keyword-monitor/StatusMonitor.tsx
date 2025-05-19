import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlayCircle, CalendarClock, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { formatDistanceToNow, format } from "date-fns";

interface StatusMonitorProps {
  onConfigureSchedule: () => void;
}

export default function StatusMonitor({ onConfigureSchedule }: StatusMonitorProps) {
  const [runningSearch, setRunningSearch] = useState(false);
  
  // Fetch current schedule
  const scheduleQuery = useQuery({
    queryKey: ["/api/keywords/monitor/schedule"],
    staleTime: 1000 * 60, // 1 minute
  });
  
  // Fetch current status
  const statusQuery = useQuery({
    queryKey: ["/api/keywords/monitor/schedule/status"],
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Auto refresh every minute
  });
  
  // Run search now mutation
  const runSearchMutation = useMutation({
    mutationFn: async () => {
      setRunningSearch(true);
      const response = await fetch("/api/keywords/monitor/schedule/run-now", {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error("Failed to run search");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Update the status and results
      queryClient.invalidateQueries({ queryKey: ["/api/keywords/monitor/schedule/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/keywords/monitor/results"] });
      setRunningSearch(false);
    },
    onError: (error) => {
      console.error("Search failed:", error);
      setRunningSearch(false);
    }
  });
  
  // Run search now
  const handleRunSearch = () => {
    runSearchMutation.mutate();
  };
  
  // Define interface for schedule data
  interface ScheduleData {
    enabled: boolean;
    frequency: string;
    time: string;
    sources: string[];
    lastRun: string | null;
    nextRun: string | null;
    id?: number;
    createdAt?: string;
    updatedAt?: string;
    days?: string[];
  }
  
  // Extract schedule data with proper typing
  const schedule: ScheduleData = scheduleQuery.data || {
    enabled: false,
    frequency: "daily",
    time: "00:00",
    sources: [],
    lastRun: null,
    nextRun: null,
    days: []
  };
  
  // Interface for status response
  interface StatusResponse {
    ran?: boolean;
    message?: string;
    results?: {
      total: number;
      bySource?: Record<string, number>;
    };
    error?: string;
  }

  // Format search status from backend response
  const getSearchStatus = () => {
    if (statusQuery.isLoading) {
      return { status: "loading", message: "Loading status..." };
    }
    
    if (statusQuery.isError) {
      console.error("Status query error:", statusQuery.error);
      return { 
        status: "error", 
        message: "Failed to load status" 
      };
    }
    
    // Ensure we have data, even if it's an empty object
    const status = statusQuery.data as StatusResponse || {};
    
    // Check if we have a valid response
    if (typeof status === 'object') {
      if (status.ran === true) {
        return { 
          status: "success",
          message: "Last search completed successfully",
          results: status.results || { total: 0, bySource: {} }
        };
      } else {
        return { 
          status: "idle",
          message: status.message || "No recent searches"
        };
      }
    } else {
      console.error("Unexpected status format:", status);
      return {
        status: "error",
        message: "Invalid status format received"
      };
    }
  };
  
  const searchStatus = getSearchStatus();
  
  // Format next run time
  const getNextRunDisplay = () => {
    if (!schedule.enabled) {
      return "Automatic searching is disabled";
    }
    
    if (!schedule.nextRun) {
      return "Not scheduled yet";
    }
    
    const nextRun = new Date(schedule.nextRun);
    
    return (
      <>
        <span className="font-medium">
          {formatDistanceToNow(nextRun, { addSuffix: true })}
        </span>
        <span className="text-muted-foreground ml-2">
          ({format(nextRun, "PPP 'at' p")})
        </span>
      </>
    );
  };
  
  // Format last run time
  const getLastRunDisplay = () => {
    if (!schedule.lastRun) {
      return "Never";
    }
    
    const lastRun = new Date(schedule.lastRun);
    
    return (
      <>
        <span className="font-medium">
          {formatDistanceToNow(lastRun, { addSuffix: true })}
        </span>
        <span className="text-muted-foreground ml-2">
          ({format(lastRun, "PPP 'at' p")})
        </span>
      </>
    );
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CalendarClock className="h-5 w-5 mr-2" />
          Scheduled Search Status
        </CardTitle>
        <CardDescription>
          Monitor and control automated searches for hydrogen health studies
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Schedule Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Status</h3>
            <div className="flex items-center">
              {schedule.enabled ? (
                <Badge className="bg-green-500">Enabled</Badge>
              ) : (
                <Badge variant="outline">Disabled</Badge>
              )}
              <span className="ml-2">
                {schedule.frequency === "daily" && "Daily"}
                {schedule.frequency === "weekly" && "Weekly"}
                {schedule.frequency === "monthly" && "Monthly"}
                {schedule.frequency === "custom" && "Custom"}
                {schedule.enabled && ` at ${schedule.time}`}
              </span>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Sources</h3>
            <div className="flex flex-wrap gap-1">
              {schedule.sources?.map(source => (
                <Badge key={source} variant="secondary" className="text-xs">
                  {source === "pubmed" && "PubMed"}
                  {source === "crossref" && "CrossRef"}
                  {source === "europepmc" && "Europe PMC"}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        
        {/* Timing Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              <Clock className="h-4 w-4 inline mr-1" />
              Next Search
            </h3>
            <p className="text-sm">{getNextRunDisplay()}</p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              <Clock className="h-4 w-4 inline mr-1" />
              Last Search
            </h3>
            <p className="text-sm">{getLastRunDisplay()}</p>
          </div>
        </div>
        
        {/* Status Alerts */}
        {searchStatus.status === "success" && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Search Complete</AlertTitle>
            <AlertDescription>
              Last search completed successfully. 
              {searchStatus.results && (
                <div className="mt-2">
                  <span className="font-medium">Found {searchStatus.results.total} new studies</span>
                  {searchStatus.results.bySource && (
                    <ul className="text-sm mt-1">
                      {Object.entries(searchStatus.results.bySource).map(([source, count]) => (
                        <li key={source}>
                          {source}: {typeof count === 'number' ? count : 0} results
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        {searchStatus.status === "error" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{searchStatus.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={onConfigureSchedule}
        >
          Configure Schedule
        </Button>
        
        <Button 
          onClick={handleRunSearch} 
          disabled={runningSearch}
        >
          {runningSearch ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <PlayCircle className="mr-2 h-4 w-4" />
              Run Search Now
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}