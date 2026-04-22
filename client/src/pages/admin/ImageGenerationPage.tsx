import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Image, Check, Zap, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

// Define types for API responses
interface StudyWithoutImage {
  id: number;
  title: string;
  abstract: string;
  category: string;
  publishDate: string;
}

interface ImageGenerationResponse {
  success: boolean;
  message: string;
  studyId?: number;
  imagePath?: string;
}

interface BatchImageResponse {
  success: boolean;
  message: string;
  studyIds?: number[];
  jobId?: string;
  total?: number;
}

interface BatchJobStatus {
  jobId: string;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  done: boolean;
}

const ImageGenerationPage: React.FC<{ embedded?: boolean }> = ({ embedded } = {}) => {
  const { toast } = useToast();
  const [batchSize, setBatchSize] = useState<number>(5);
  const [selectedStudyId, setSelectedStudyId] = useState<number | null>(null);
  const [isLoadingStudies, setIsLoadingStudies] = useState<boolean>(true);
  const [studiesNeedingImages, setStudiesNeedingImages] = useState<number[]>(
    [],
  );
  const [isGeneratingSingle, setIsGeneratingSingle] = useState<boolean>(false);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState<boolean>(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState<boolean>(false);
  const [activeJob, setActiveJob] = useState<BatchJobStatus | null>(null);

  // Deep-link: when opened with ?studyId=123, offer a one-click action
  // that generates an image just for that study.
  const focusedStudyId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("studyId");
    const id = raw ? Number(raw) : NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  }, []);

  const focusedStudyQuery = useQuery<any>({
    queryKey: [`/api/studies/${focusedStudyId}`],
    enabled: !!focusedStudyId,
  });

  // Fetch studies needing images
  const fetchStudiesNeedingImages = async () => {
    setIsLoadingStudies(true);
    try {
      const response = await fetch(
        "/api/image-generation/find-studies-needing-images",
      );
      const data = await response.json();

      if (data.success) {
        setStudiesNeedingImages(data.studyIds || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch studies needing images",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch studies needing images",
        variant: "destructive",
      });
    } finally {
      setIsLoadingStudies(false);
    }
  };

  // Generate a single image
  const generateSingleImage = async (studyId: number) => {
    setSelectedStudyId(studyId);
    setIsGeneratingSingle(true);

    try {
      const response = await fetch(
        `/api/image-generation/generate/${studyId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Image Generated",
          description: `Successfully generated image for study #${studyId}`,
          variant: "default",
        });

        // Refresh the list of studies needing images
        fetchStudiesNeedingImages();
      } else {
        toast({
          title: "Error",
          description: `Failed to generate image: ${data.message}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSingle(false);
      setSelectedStudyId(null);
    }
  };

  // Generate images in batch
  const generateBatchImages = async () => {
    setIsGeneratingBatch(true);

    try {
      // First, get the studies needing images
      const listResponse = await fetch(
        `/api/image-generation/find-studies-needing-images?limit=${batchSize}`,
      );
      const listData = await listResponse.json();

      if (
        !listData.success ||
        !listData.studyIds ||
        listData.studyIds.length === 0
      ) {
        toast({
          title: "No Studies Found",
          description:
            "No studies need images or there was an error finding them.",
          variant: "destructive",
        });
        setIsGeneratingBatch(false);
        return;
      }

      // Now start the batch process
      const response = await fetch("/api/image-generation/batch-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studyIds: listData.studyIds }),
      });

      const data: BatchImageResponse = await response.json();

      if (data.success) {
        if (data.jobId && data.total) {
          setActiveJob({
            jobId: data.jobId,
            total: data.total,
            completed: 0,
            succeeded: 0,
            failed: 0,
            done: false,
          });
        }
        toast({
          title: "Batch Processing Started",
          description: `Started processing ${listData.studyIds.length} studies. Progress shown below.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Error",
          description: `Failed to start batch generation: ${data.message}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          "Failed to start batch image generation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  // Auto-generate all images
  const autoGenerateAllImages = async () => {
    if (
      !confirm(
        "This will start generating images for ALL studies without images. The process will run in the background and may take a significant amount of time. Do you want to continue?",
      )
    ) {
      return;
    }

    setIsGeneratingAll(true);

    try {
      const response = await fetch("/api/image-generation/auto-generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data: BatchImageResponse = await response.json();

      if (data.success) {
        if (data.jobId && data.total) {
          setActiveJob({
            jobId: data.jobId,
            total: data.total,
            completed: 0,
            succeeded: 0,
            failed: 0,
            done: false,
          });
        }
        toast({
          title: "Auto-Generation Started",
          description:
            data.message ||
            `Started generating images for ${data.total ?? "all"} studies. Progress shown below.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Error",
          description: `Failed to start auto generation: ${data.message}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start auto image generation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAll(false);
    }
  };

  // Fetch studies on initial load
  useEffect(() => {
    fetchStudiesNeedingImages();
  }, []);

  // While a batch job is active, poll /jobs/:id every 3s so the user sees
  // live progress instead of just a "started" toast. When the job reports
  // done, refresh the "studies needing images" list to reflect the new
  // image_url writes. Finished jobs linger on the server for 10 min; once
  // the endpoint returns 404 we clear local state.
  useEffect(() => {
    if (!activeJob || activeJob.done) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/image-generation/jobs/${activeJob.jobId}`);
        if (res.status === 404) {
          if (!cancelled) setActiveJob(null);
          return;
        }
        const data = await res.json();
        if (cancelled || !data.success) return;
        setActiveJob({
          jobId: activeJob.jobId,
          total: data.total,
          completed: data.completed,
          succeeded: data.succeeded,
          failed: data.failed,
          done: !!data.done,
        });
        if (data.done) {
          toast({
            title: "Batch finished",
            description: `${data.succeeded} succeeded, ${data.failed} failed out of ${data.total}.`,
          });
          fetchStudiesNeedingImages();
        }
      } catch {
        // Transient — next tick will retry.
      }
    };

    tick();
    const interval = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeJob?.jobId, activeJob?.done, toast]);

  const content = (
    <>
      {focusedStudyId && (
        <Alert className="mb-6">
          <ArrowRight className="h-4 w-4" />
          <AlertTitle>
            Focused on study #{focusedStudyId}
            {focusedStudyQuery.data?.title ? `: ${focusedStudyQuery.data.title}` : ""}
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3 mt-2">
            <span>Generate an image just for this study.</span>
            <Button
              size="sm"
              onClick={() => generateSingleImage(focusedStudyId)}
              disabled={isGeneratingSingle && selectedStudyId === focusedStudyId}
            >
              {isGeneratingSingle && selectedStudyId === focusedStudyId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate image"
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Studies Without Images</CardTitle>
            <CardDescription>
              Find studies that need images generated
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {isLoadingStudies ? (
                <Skeleton className="h-4 w-48" />
              ) : (
                `${studiesNeedingImages.length} studies need images`
              )}
            </p>
            <Button
              onClick={fetchStudiesNeedingImages}
              variant="outline"
              className="w-full"
            >
              Refresh List
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Batch Generate</CardTitle>
            <CardDescription>
              Generate images for multiple studies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <Input
                type="number"
                min={1}
                max={20}
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value) || 5)}
                className="w-20"
              />
              <span className="text-muted-foreground">studies at once</span>
            </div>
            <Button
              onClick={generateBatchImages}
              disabled={isGeneratingBatch || studiesNeedingImages.length === 0}
              className="w-full"
            >
              {isGeneratingBatch ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>Generate Images</>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-teal-200 bg-teal-50">
          <CardHeader>
            <CardTitle className="flex items-center text-teal-700">
              <Zap className="w-5 h-5 mr-2" />
              Auto-Generate All Images
            </CardTitle>
            <CardDescription>
              Generate images for all studies in the database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This will find all studies without images and generate AI
              visuals for them in the background.
            </p>
            <Button
              onClick={autoGenerateAllImages}
              disabled={isGeneratingAll || (activeJob && !activeJob.done) || false}
              className="w-full bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700"
            >
              {isGeneratingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : activeJob && !activeJob.done ? (
                <>Batch in progress…</>
              ) : (
                <>Auto-Generate All Missing Images</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Live batch progress card */}
      {activeJob && (
        <Card className="mb-6 border-teal-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <Activity className="h-4 w-4 mr-2 text-teal-600" />
              {activeJob.done ? "Batch finished" : "Batch in progress"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                (job {activeJob.jobId})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                {activeJob.completed} of {activeJob.total} processed
                {" · "}
                <span className="text-green-600">{activeJob.succeeded} ok</span>
                {activeJob.failed > 0 && (
                  <>
                    {" · "}
                    <span className="text-destructive">{activeJob.failed} failed</span>
                  </>
                )}
              </span>
              <span className="font-medium">
                {activeJob.total > 0
                  ? Math.round((activeJob.completed / activeJob.total) * 100)
                  : 0}
                %
              </span>
            </div>
            <Progress
              value={
                activeJob.total > 0
                  ? (activeJob.completed / activeJob.total) * 100
                  : 0
              }
              className="h-2"
            />
            {activeJob.done && (
              <div className="mt-3 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveJob(null)}
                >
                  Dismiss
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <h2 className="text-xl font-semibold mb-4">Studies Needing Images</h2>

      {isLoadingStudies ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : studiesNeedingImages.length === 0 ? (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center text-green-600 mb-2">
              <Check className="mr-2 h-5 w-5" />
              <h3 className="font-medium">All Studies Have Images</h3>
            </div>
            <p className="text-green-700">
              Great! All studies in the database have images generated.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {studiesNeedingImages.map((studyId: number) => (
            <Card key={studyId}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">
                      Study #{studyId}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      Missing Image
                    </p>
                  </div>
                  <Button
                    onClick={() => generateSingleImage(studyId)}
                    disabled={isGeneratingSingle && selectedStudyId === studyId}
                    size="sm"
                    className="shrink-0"
                  >
                    {isGeneratingSingle && selectedStudyId === studyId ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Image className="mr-2 h-4 w-4" />
                        Generate Image
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <AdminLayout
      title="Image Generation"
      description="Generate scientific images for studies without media"
    >
      {content}
    </AdminLayout>
  );
};

export default ImageGenerationPage;
