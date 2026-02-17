/**
 * Content Optimization Admin Page
 * Manage content relationships, updates, and versioning
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Link,
  GitBranch,
  Bell,
  History,
  TrendingUp,
  Eye,
  Edit,
  PlayCircle,
  PauseCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface UpdateNotification {
  id: number;
  contentType: string;
  contentId: number;
  triggerType: string;
  triggerContentId?: number;
  priority: string;
  priorityScore: number;
  status: string;
  updateSummary?: string;
  suggestedChanges?: string;
  impactedSections?: string[];
  reviewedBy?: string;
  reviewedAt?: Date;
  appliedAt?: Date;
  notes?: string;
  createdAt: Date;
}

interface ContentRelationship {
  id: number;
  sourceType: string;
  sourceId: number;
  targetType: string;
  targetId: number;
  relationshipType: string;
  confidence: number;
  autoDetected: boolean;
  notes?: string;
  createdAt: Date;
}

interface DashboardStats {
  pendingNotifications: Array<{ priority: string; count: number }>;
  recentUpdates: number;
  totalRelationships: number;
  smartLinks: {
    active: number;
    total: number;
  };
}

export default function ContentOptimizationPage() {
  const [selectedTab, setSelectedTab] = useState("notifications");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [selectedNotification, setSelectedNotification] =
    useState<UpdateNotification | null>(null);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);

  // Fetch dashboard stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["/api/content-optimization/dashboard/stats"],
  });

  // Fetch notifications
  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: [
      "/api/content-optimization/notifications",
      filterStatus,
      filterPriority,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterPriority !== "all") params.append("priority", filterPriority);
      const response = await fetch(
        `/api/content-optimization/notifications?${params}`,
      );
      return response.json();
    },
  });

  // Apply notification mutation
  const applyNotification = useMutation({
    mutationFn: async (data: {
      notificationId: number;
      reviewedBy: string;
    }) => {
      return apiRequest("/api/content-optimization/notifications/apply", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Update Applied",
        description: "The content update has been applied successfully.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/content-optimization/notifications"],
      });
      refetchStats();
      setSelectedNotification(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to apply update. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Reject notification mutation
  const rejectNotification = useMutation({
    mutationFn: async (data: {
      id: number;
      notes: string;
      reviewedBy: string;
    }) => {
      return apiRequest(
        `/api/content-optimization/notifications/${data.id}/reject`,
        {
          method: "POST",
          body: JSON.stringify({
            notes: data.notes,
            reviewedBy: data.reviewedBy,
          }),
        },
      );
    },
    onSuccess: () => {
      toast({
        title: "Update Rejected",
        description: "The update notification has been rejected.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/content-optimization/notifications"],
      });
      refetchStats();
      setSelectedNotification(null);
    },
  });

  // Start/stop auto-update detector
  const toggleAutoUpdate = useMutation({
    mutationFn: async (enable: boolean) => {
      const endpoint = enable ? "start" : "stop";
      return apiRequest(`/api/content-optimization/auto-update/${endpoint}`, {
        method: "POST",
        body: JSON.stringify({ intervalMinutes: 60 }),
      });
    },
    onSuccess: (_, enable) => {
      setAutoUpdateEnabled(enable);
      toast({
        title: enable ? "Auto-Update Started" : "Auto-Update Stopped",
        description: enable
          ? "Content will be automatically checked for updates every hour."
          : "Automatic update detection has been stopped.",
      });
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-teal-500";
      default:
        return "bg-gray-500";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "critical":
        return <AlertCircle className="h-4 w-4" />;
      case "high":
        return <AlertTriangle className="h-4 w-4" />;
      case "medium":
        return <Info className="h-4 w-4" />;
      case "low":
        return <Info className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <AdminLayout title="Content Optimization">
      <div className="space-y-6">
        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Updates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.data?.pendingNotifications?.map((item: any) => (
                  <div
                    key={item.priority}
                    className="flex items-center justify-between"
                  >
                    <Badge className={getPriorityColor(item.priority)}>
                      {item.priority}
                    </Badge>
                    <span className="text-2xl font-bold">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Recent Updates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {stats?.data?.recentUpdates || 0}
              </div>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Content Relationships
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {stats?.data?.totalRelationships || 0}
              </div>
              <p className="text-xs text-muted-foreground">Total tracked</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Smart Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {stats?.data?.smartLinks?.active || 0} /{" "}
                {stats?.data?.smartLinks?.total || 0}
              </div>
              <p className="text-xs text-muted-foreground">Active / Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Auto-Update Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Auto-Update Detection</span>
              <Button
                variant={autoUpdateEnabled ? "destructive" : "default"}
                size="sm"
                onClick={() => toggleAutoUpdate.mutate(!autoUpdateEnabled)}
                disabled={toggleAutoUpdate.isPending}
              >
                {autoUpdateEnabled ? (
                  <>
                    <PauseCircle className="mr-2 h-4 w-4" />
                    Stop
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Start
                  </>
                )}
              </Button>
            </CardTitle>
            <CardDescription>
              {autoUpdateEnabled
                ? "System is actively monitoring for content updates"
                : "Automatic update detection is currently disabled"}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="notifications">
              <Bell className="mr-2 h-4 w-4" />
              Update Notifications
            </TabsTrigger>
            <TabsTrigger value="relationships">
              <GitBranch className="mr-2 h-4 w-4" />
              Relationships
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="mr-2 h-4 w-4" />
              Update History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="mt-6">
            {/* Filters */}
            <div className="flex gap-4 mb-4">
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notifications List */}
            <Card>
              <CardHeader>
                <CardTitle>Update Notifications</CardTitle>
                <CardDescription>
                  Review and apply content updates triggered by new research
                </CardDescription>
              </CardHeader>
              <CardContent>
                {notificationsLoading ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {notifications?.data?.map(
                        (notification: UpdateNotification) => (
                          <Card
                            key={notification.id}
                            className="cursor-pointer hover:bg-accent"
                            onClick={() =>
                              setSelectedNotification(notification)
                            }
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    {getPriorityIcon(notification.priority)}
                                    <Badge
                                      className={getPriorityColor(
                                        notification.priority,
                                      )}
                                    >
                                      {notification.priority}
                                    </Badge>
                                    <Badge variant="outline">
                                      {notification.contentType}
                                    </Badge>
                                    <Badge variant="secondary">
                                      {notification.triggerType}
                                    </Badge>
                                  </div>
                                  <p className="text-sm font-medium mb-1">
                                    {notification.updateSummary}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Created{" "}
                                    {format(
                                      new Date(notification.createdAt),
                                      "PPp",
                                    )}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedNotification(notification);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ),
                      )}
                      {notifications?.data?.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No notifications found with current filters
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="relationships">
            <Card>
              <CardHeader>
                <CardTitle>Content Relationships</CardTitle>
                <CardDescription>
                  View and manage relationships between content pieces
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Relationship Tracking</AlertTitle>
                  <AlertDescription>
                    The system automatically detects and tracks relationships
                    between studies, blog articles, and other content. These
                    relationships help identify when content needs updates based
                    on new research.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Update History</CardTitle>
                <CardDescription>
                  View the complete history of content updates and changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <History className="h-4 w-4" />
                  <AlertTitle>Version Control</AlertTitle>
                  <AlertDescription>
                    All content changes are tracked with complete version
                    history, allowing you to review what changed, when it
                    changed, and who made the changes.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Notification Detail Dialog */}
        {selectedNotification && (
          <Dialog
            open={!!selectedNotification}
            onOpenChange={() => setSelectedNotification(null)}
          >
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Update Notification Details</DialogTitle>
                <DialogDescription>
                  Review the suggested changes and apply or reject the update
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Content Type</p>
                    <Badge variant="outline">
                      {selectedNotification.contentType}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Priority</p>
                    <Badge
                      className={getPriorityColor(
                        selectedNotification.priority,
                      )}
                    >
                      {selectedNotification.priority}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Trigger Type</p>
                    <Badge variant="secondary">
                      {selectedNotification.triggerType}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Status</p>
                    <Badge>{selectedNotification.status}</Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium mb-2">Update Summary</p>
                  <p className="text-sm">
                    {selectedNotification.updateSummary}
                  </p>
                </div>

                {selectedNotification.suggestedChanges && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Suggested Changes
                    </p>
                    <Card>
                      <CardContent className="p-3">
                        <pre className="text-sm whitespace-pre-wrap">
                          {selectedNotification.suggestedChanges}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {selectedNotification.impactedSections &&
                  selectedNotification.impactedSections.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        Impacted Sections
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedNotification.impactedSections.map(
                          (section, idx) => (
                            <Badge key={idx} variant="outline">
                              {section}
                            </Badge>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                {selectedNotification.status === "pending" && (
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const notes = prompt("Rejection reason (optional):");
                        if (notes !== null) {
                          rejectNotification.mutate({
                            id: selectedNotification.id,
                            notes: notes || "",
                            reviewedBy: "admin", // Should use actual user ID
                          });
                        }
                      }}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => {
                        applyNotification.mutate({
                          notificationId: selectedNotification.id,
                          reviewedBy: "admin", // Should use actual user ID
                        });
                      }}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Apply Update
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AdminLayout>
  );
}
