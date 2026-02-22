import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlayCircle, CheckCircle } from "lucide-react";
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

export default function SimpleStatusMonitor({
  onConfigureSchedule,
}: StatusMonitorProps) {
  const [runningSearch, setRunningSearch] = useState(false);

  // Fetch current schedule
  const scheduleQuery = useQuery({
    queryKey: ["/api/keywords/monitor/schedule"],
    staleTime: 1000 * 60, // 1 minute
  });

  // State for success message
  const [showSuccess, setShowSuccess] = useState(false);

  // Run search now mutation
  const runSearchMutation = useMutation({
    mutationFn: async () => {
      setRunningSearch(true);
      const response = await fetch("/api/keywords/monitor/run-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }
      const data = await response.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/keywords/monitor/schedule"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/keywords/results"] });
      setRunningSearch(false);

      // Show success message and auto-hide after 3 seconds
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: () => {
      setRunningSearch(false);
    },
  });

  // Cast the query data to our defined schema type with defaults
  const scheduleData: ScheduleData = (scheduleQuery.data as ScheduleData) || {
    enabled: false,
    frequency: "",
    time: "",
    sources: [],
    lastRun: null,
    nextRun: null,
    days: [],
  };

  // Determine the schedule state
  const isScheduleEnabled = !!scheduleData.enabled;
  const hasScheduleSources =
    Array.isArray(scheduleData.sources) && scheduleData.sources.length > 0;

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
        {/* Success message */}
        {showSuccess && (
          <Alert className="mb-4">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Search Started</AlertTitle>
            <AlertDescription>
              The keyword search has been started successfully. Any matches will
              appear in the "Monitor Results" tab.
            </AlertDescription>
          </Alert>
        )}

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
              <strong>Status:</strong>{" "}
              {isScheduleEnabled ? "Active" : "Inactive"}
            </p>
            <p>
              <strong>Frequency:</strong> {scheduleData.frequency || "Not set"}
            </p>
            <p>
              <strong>Next Run:</strong>{" "}
              {scheduleData.nextRun
                ? new Date(scheduleData.nextRun).toLocaleString()
                : "Not scheduled"}
            </p>
            <p>
              <strong>Last Run:</strong>{" "}
              {scheduleData.lastRun
                ? new Date(scheduleData.lastRun).toLocaleString()
                : "Never run"}
            </p>
            <p>
              <strong>Sources:</strong>{" "}
              {hasScheduleSources && scheduleData.sources
                ? scheduleData.sources.join(", ")
                : "No sources configured"}
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
              Run Now
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
