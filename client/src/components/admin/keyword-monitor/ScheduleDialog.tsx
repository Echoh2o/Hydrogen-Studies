import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Clock, Calendar } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSchedule: {
    enabled: boolean;
    frequency: string;
    time: string;
    days: string[];
    sources: string[];
  } | null;
}

export default function ScheduleDialog({ 
  open, 
  onOpenChange,
  currentSchedule
}: ScheduleDialogProps) {
  // Initialize with current schedule or defaults
  const [schedule, setSchedule] = useState({
    enabled: currentSchedule?.enabled || false,
    frequency: currentSchedule?.frequency || "daily",
    time: currentSchedule?.time || "00:00",
    days: currentSchedule?.days || ["monday", "wednesday", "friday"],
    sources: currentSchedule?.sources || ["pubmed", "crossref", "europepmc"]
  });

  // Available schedule frequencies
  const frequencies = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "custom", label: "Custom Days" }
  ];

  // Available days for custom schedule
  const days = [
    { value: "monday", label: "Monday" },
    { value: "tuesday", label: "Tuesday" },
    { value: "wednesday", label: "Wednesday" },
    { value: "thursday", label: "Thursday" },
    { value: "friday", label: "Friday" },
    { value: "saturday", label: "Saturday" },
    { value: "sunday", label: "Sunday" }
  ];

  // Available sources to search
  const sources = [
    { value: "pubmed", label: "PubMed" },
    { value: "crossref", label: "CrossRef" },
    { value: "europepmc", label: "Europe PMC" }
  ];

  // Update schedule mutation
  const updateScheduleMutation = useMutation({
    mutationFn: async (scheduleData: typeof schedule) => {
      const response = await fetch("/api/keywords/monitor/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(scheduleData)
      });
      
      if (!response.ok) {
        throw new Error("Failed to update schedule");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keywords/monitor/schedule"] });
      onOpenChange(false);
    }
  });

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateScheduleMutation.mutate(schedule);
  };

  // Toggle schedule enabled state
  const toggleEnabled = () => {
    setSchedule(prev => ({
      ...prev,
      enabled: !prev.enabled
    }));
  };

  // Update frequency
  const updateFrequency = (value: string) => {
    setSchedule(prev => ({
      ...prev,
      frequency: value
    }));
  };

  // Update time
  const updateTime = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSchedule(prev => ({
      ...prev,
      time: e.target.value
    }));
  };

  // Toggle day selection for custom schedule
  const toggleDay = (day: string) => {
    setSchedule(prev => {
      const newDays = prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day];
      
      return {
        ...prev,
        days: newDays
      };
    });
  };

  // Toggle source selection
  const toggleSource = (source: string) => {
    setSchedule(prev => {
      const newSources = prev.sources.includes(source)
        ? prev.sources.filter(s => s !== source)
        : [...prev.sources, source];
      
      return {
        ...prev,
        sources: newSources
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Schedule Automatic Study Searches
          </DialogTitle>
          <DialogDescription>
            Configure when and how often to search scientific databases for new hydrogen health studies.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Enable/Disable Switch */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="schedule-enabled">Automatic Search</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable scheduled searching
              </p>
            </div>
            <Switch
              id="schedule-enabled"
              checked={schedule.enabled}
              onCheckedChange={toggleEnabled}
            />
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency">Search Frequency</Label>
            <Select
              value={schedule.frequency}
              onValueChange={updateFrequency}
              disabled={!schedule.enabled}
            >
              <SelectTrigger id="frequency">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {frequencies.map(freq => (
                  <SelectItem key={freq.value} value={freq.value}>
                    {freq.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label htmlFor="search-time">Search Time (UTC)</Label>
            <Input
              id="search-time"
              type="time"
              value={schedule.time}
              onChange={updateTime}
              disabled={!schedule.enabled}
            />
          </div>

          {/* Days selection (for custom frequency) */}
          {schedule.frequency === "custom" && (
            <div className="space-y-2">
              <Label>Days to Run</Label>
              <div className="grid grid-cols-4 gap-2">
                {days.map(day => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={schedule.days.includes(day.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleDay(day.value)}
                    disabled={!schedule.enabled}
                    className="text-xs"
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          <div className="space-y-2">
            <Label>Sources to Search</Label>
            <div className="grid grid-cols-3 gap-2">
              {sources.map(source => (
                <Button
                  key={source.value}
                  type="button"
                  variant={schedule.sources.includes(source.value) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleSource(source.value)}
                  disabled={!schedule.enabled}
                >
                  {source.label}
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateScheduleMutation.isPending}>
              {updateScheduleMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Schedule"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}