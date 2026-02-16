/**
 * Comprehensive Image Management Admin Page
 */

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  RefreshCw,
  Play,
  Square,
  CheckCircle,
  AlertCircle,
  Image,
} from "lucide-react";

interface SystemStatus {
  totalStudies: number;
  studiesWithImages: number;
  studiesNeedingImages: number;
  isProcessing: boolean;
  lastProcessed: Date;
}

interface ProcessingStats {
  isRunning: boolean;
  processed: number;
  failed: number;
  startTime: Date;
  estimatedTimeRemaining: number;
}

export default function ComprehensiveImageManagement() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
    fetchStats();

    // Set up polling for real-time updates
    const interval = setInterval(() => {
      fetchStatus();
      fetchStats();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/comprehensive-images/system-status");
      const data = await response.json();
      if (data.success) {
        setStatus(data.status);
      }
    } catch (error) {
      console.error("Error fetching status:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(
        "/api/comprehensive-images/processing-stats",
      );
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const startProcessing = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(
        "/api/comprehensive-images/start-comprehensive-processing",
        {
          method: "POST",
        },
      );
      const data = await response.json();

      if (data.success) {
        fetchStatus();
        fetchStats();
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error starting processing:", error);
      alert("Failed to start processing");
    } finally {
      setActionLoading(false);
    }
  };

  const stopProcessing = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(
        "/api/comprehensive-images/stop-processing",
        {
          method: "POST",
        },
      );
      const data = await response.json();

      if (data.success) {
        fetchStatus();
        fetchStats();
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error stopping processing:", error);
      alert("Failed to stop processing");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const completionPercentage = status
    ? Math.round((status.studiesWithImages / status.totalStudies) * 100)
    : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Comprehensive Image Management
        </h1>
        <p className="text-gray-600">
          Manage AI-generated images with SEO optimization and performance
          features
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* System Overview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Image className="h-5 w-5" />
              System Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress</span>
                  <span>{completionPercentage}%</span>
                </div>
                <Progress value={completionPercentage} className="h-2" />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Total Studies</p>
                  <p className="font-semibold">{status?.totalStudies || 0}</p>
                </div>
                <div>
                  <p className="text-gray-500">With Images</p>
                  <p className="font-semibold text-green-600">
                    {status?.studiesWithImages || 0}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Need Images</p>
                  <p className="font-semibold text-orange-600">
                    {status?.studiesNeedingImages || 0}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <Badge
                    variant={status?.isProcessing ? "default" : "secondary"}
                  >
                    {status?.isProcessing ? "Processing" : "Idle"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Processing Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw
                className={`h-5 w-5 ${stats?.isRunning ? "animate-spin" : ""}`}
              />
              Processing Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Processed</p>
                    <p className="font-semibold text-blue-600">
                      {stats.processed}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Failed</p>
                    <p className="font-semibold text-red-600">{stats.failed}</p>
                  </div>
                </div>
                {stats.isRunning && (
                  <div>
                    <p className="text-gray-500 text-sm">Est. Time Remaining</p>
                    <p className="font-semibold">
                      {Math.ceil(stats.estimatedTimeRemaining / 60000)} minutes
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No processing data available</p>
            )}
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {!status?.isProcessing ? (
                <Button
                  onClick={startProcessing}
                  disabled={actionLoading || status?.studiesNeedingImages === 0}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Processing
                </Button>
              ) : (
                <Button
                  onClick={stopProcessing}
                  disabled={actionLoading}
                  variant="destructive"
                  className="w-full"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Processing
                </Button>
              )}

              <Button
                onClick={() => {
                  fetchStatus();
                  fetchStats();
                }}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Status
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <div className="space-y-4">
        {status?.studiesNeedingImages === 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              All studies have optimized images! Your image system is complete.
            </AlertDescription>
          </Alert>
        )}

        {status?.isProcessing && (
          <Alert>
            <RefreshCw className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Processing {status.studiesNeedingImages} studies. Images are being
              generated with SEO optimization and WebP conversion for fast
              loading.
            </AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Features:</strong> This system generates AI images with
            DALL-E 3, optimizes them to WebP format, creates SEO-friendly alt
            text, and implements lazy loading for better performance.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
