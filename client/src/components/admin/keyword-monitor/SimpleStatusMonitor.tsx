import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlayCircle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface StatusMonitorProps {
  onConfigureSchedule: () => void;
}

interface ScheduleData {
  enabled?: boolean;
  frequency?: string;
  time?: string;
  sources?: string[];
  lastRun?: string | null;
  nextRun?: string | null;
  days?: string[];
}

export default function SimpleStatusMonitor({ onConfigureSchedule }: StatusMonitorProps) {
  const [runningSearch, setRunningSearch] = useState(false);
  
  // Fetch current schedule
  const scheduleQuery = useQuery({
    queryKey: ["/api/keywords/monitor/schedule"],
    staleTime: 1000 * 60, // 1 minute
  });

  // Run search now mutation
  const runSearchMutation = useMutation({
    mutationFn: async () => {
      setRunningSearch(true);
      const response = await fetch("/api/keywords/monitor/schedule/run", {
        method: "POST",
      });
      
      const data = await response.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords/monitor/schedule"] });
      setRunningSearch(false);
    },
    onError: () => {
      setRunningSearch(false);
    }
  });
  
  // Cast the query data to our defined schema type with defaults
  const scheduleData: ScheduleData = (scheduleQuery.data as ScheduleData) || {
    enabled: false,
    frequency: "",
    time: "",
    sources: [],
    lastRun: null,
    nextRun: null,
    days: []
  };
  
  // Determine the schedule state
  const isScheduleEnabled = !!scheduleData.enabled;
  const hasScheduleSources = Array.isArray(scheduleData.sources) && scheduleData.sources.length > 0;
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Monitoring Status</span>
          <Badge variant={isScheduleEnabled ? "default" : "outline"}>
            {isScheduleEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </CardTitle>
        <CardDescription>Current monitoring schedule status</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {scheduleQuery.isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        {scheduleQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              Could not load schedule information. Please try again later.
            </AlertDescription>
          </Alert>
        )}
        
        {!scheduleQuery.isLoading && !scheduleQuery.isError && (
          <div className="grid gap-4">
            <p>
              <strong>Status:</strong> {isScheduleEnabled ? "Active" : "Inactive"}
            </p>
            <p>
              <strong>Frequency:</strong> {scheduleData.frequency || "Not set"}
            </p>
            <p>
              <strong>Next Run:</strong> {scheduleData.nextRun ? new Date(scheduleData.nextRun).toLocaleString() : "Not scheduled"}
            </p>
            <p>
              <strong>Last Run:</strong> {scheduleData.lastRun ? new Date(scheduleData.lastRun).toLocaleString() : "Never run"}
            </p>
            <p>
              <strong>Sources:</strong> {hasScheduleSources && scheduleData.sources ? scheduleData.sources.join(", ") : "No sources configured"}
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onConfigureSchedule}>
          Configure Schedule
        </Button>
        
        <Button 
          onClick={() => runSearchMutation.mutate()} 
          disabled={runningSearch || !isScheduleEnabled || !hasScheduleSources}
        >
          {runningSearch ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <PlayCircle className="mr-2 h-4 w-4" />
              Run Now
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}