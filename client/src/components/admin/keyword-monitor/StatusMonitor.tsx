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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  PlayCircle,
  CalendarClock,
  CheckCircle,
  Clock,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { formatDistanceToNow, format } from "date-fns";

interface StatusMonitorProps {
  onConfigureSchedule: () => void;
}

export default function StatusMonitor({
  onConfigureSchedule,
}: StatusMonitorProps) {
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
      queryClient.invalidateQueries({
        queryKey: ["/api/keywords/monitor/schedule"],
      });
      setRunningSearch(false);
    },
    onError: () => {
      setRunningSearch(false);
    },
  });

  // Handle loading state
  if (scheduleQuery.isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Monitoring Status</CardTitle>
          <CardDescription>Loading schedule information...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Get schedule data with default values
  const schedule = {
    enabled: false,
    frequency: "weekly",
    time: "00:00",
    sources: [] as string[],
    lastRun: null as string | null,
    nextRun: null as string | null,
    days: [] as string[],
    ...(scheduleQuery.data || {}),
  };

  // Format next run time
  const getNextRunDisplay = () => {
    if (!schedule.enabled) {
      return "Not scheduled";
    }

    if (!schedule.nextRun) {
      return "Not yet scheduled";
    }

    const nextRunDate = new Date(schedule.nextRun);
    return (
      <>
        <span className="font-medium">
          {formatDistanceToNow(nextRunDate, { addSuffix: true })}
        </span>
        <span className="text-muted-foreground ml-2">
          ({format(nextRunDate, "PPP 'at' p")})
        </span>
      </>
    );
  };

  // Format last run time
  const getLastRunDisplay = () => {
    if (!schedule.lastRun) {
      return "Never run";
    }

    const lastRunDate = new Date(schedule.lastRun);
    return (
      <>
        <span className="font-medium">
          {formatDistanceToNow(lastRunDate, { addSuffix: true })}
        </span>
        <span className="text-muted-foreground ml-2">
          ({format(lastRunDate, "PPP 'at' p")})
        </span>
      </>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Monitoring Status</span>
          <Badge variant={schedule.enabled ? "default" : "outline"}>
            {schedule.enabled ? "Enabled" : "Disabled"}
          </Badge>
        </CardTitle>
        <CardDescription>Current monitoring schedule status</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {scheduleQuery.isError && (
          <Alert variant="destructive">
            Could not load schedule information. Please try again later.
          </Alert>
        )}

        {/* Schedule Info */}
        <div className="grid gap-4">
          <div className="flex items-start gap-2">
            <CalendarClock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold">Next Scheduled Run</h4>
              <p className="text-sm">{getNextRunDisplay()}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold">Last Run</h4>
              <p className="text-sm">{getLastRunDisplay()}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold">Sources</h4>
              <p className="text-sm">
                {Array.isArray(schedule.sources) && schedule.sources.length > 0
                  ? schedule.sources.join(", ")
                  : "No sources configured"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onConfigureSchedule}>
          Configure Schedule
        </Button>

        <Button
          onClick={() => runSearchMutation.mutate()}
          disabled={
            runningSearch ||
            !schedule.enabled ||
            !Array.isArray(schedule.sources) ||
            schedule.sources.length === 0
          }
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
