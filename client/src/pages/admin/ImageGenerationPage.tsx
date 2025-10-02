import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
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
}

const ImageGenerationPage: React.FC = () => {
  const { toast } = useToast();
  const [batchSize, setBatchSize] = useState<number>(5);
  const [selectedStudyId, setSelectedStudyId] = useState<number | null>(null);
  const [autoGenStarted, setAutoGenStarted] = useState<boolean>(false);
  const [isLoadingStudies, setIsLoadingStudies] = useState<boolean>(true);
  const [studiesNeedingImages, setStudiesNeedingImages] = useState<number[]>(
    [],
  );
  const [isGeneratingSingle, setIsGeneratingSingle] = useState<boolean>(false);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState<boolean>(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState<boolean>(false);

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
        console.error("Error fetching studies needing images:", data.message);
        toast({
          title: "Error",
          description: "Failed to fetch studies needing images",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching studies needing images:", error);
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
        console.error("Error generating image:", data.message);
        toast({
          title: "Error",
          description: `Failed to generate image: ${data.message}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error generating image:", error);
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

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Batch Processing Started",
          description: `Started processing ${listData.studyIds.length} studies. This will run in the background.`,
          variant: "default",
        });

        // Wait a moment then refresh the list
        setTimeout(fetchStudiesNeedingImages, 5000);
      } else {
        console.error("Error batch generating images:", data.message);
        toast({
          title: "Error",
          description: `Failed to start batch generation: ${data.message}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error batch generating images:", error);
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

      const data = await response.json();

      if (data.success) {
        setAutoGenStarted(true);
        toast({
          title: "Auto-Generation Started",
          description:
            data.message ||
            "Started generating images for all studies that need them. This process will run in the background.",
          variant: "default",
        });

        // Wait a moment then refresh the list
        setTimeout(fetchStudiesNeedingImages, 5000);
      } else {
        console.error("Error auto generating images:", data.message);
        toast({
          title: "Error",
          description: `Failed to start auto generation: ${data.message}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error starting auto image generation:", error);
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

  return (
    <AdminLayout
      title="Image Generation"
      description="Generate scientific images for studies without media"
    >
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

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-700">
              <Zap className="w-5 h-5 mr-2" />
              Auto-Generate All Images
            </CardTitle>
            <CardDescription>
              Generate images for all studies in the database
            </CardDescription>
          </CardHeader>
          <CardContent>
            {autoGenStarted ? (
              <Alert className="bg-green-50 border-green-200 text-green-800">
                <Activity className="h-4 w-4" />
                <AlertTitle>Auto-Generation In Progress</AlertTitle>
                <AlertDescription>
                  Image generation is running in the background. This process
                  may take some time to complete.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">
                  This will find all studies without images and generate AI
                  visuals for them in the background.
                </p>
                <Button
                  onClick={autoGenerateAllImages}
                  disabled={isGeneratingAll}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {isGeneratingAll ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>Auto-Generate All Missing Images</>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

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
    </AdminLayout>
  );
};

export default ImageGenerationPage;
