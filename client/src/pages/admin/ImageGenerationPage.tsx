import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  const queryClient = useQueryClient();
  const [batchSize, setBatchSize] = useState<number>(5);
  const [selectedStudyId, setSelectedStudyId] = useState<number | null>(null);
  const [autoGenStarted, setAutoGenStarted] = useState<boolean>(false);

  // Query for studies needing images
  const {
    data: studiesNeedingImages,
    isLoading: isLoadingStudies,
    isError: isErrorStudies,
    refetch: refetchStudies
  } = useQuery({
    queryKey: ["/api/image-generation/find-studies-needing-images"],
    retry: 3,
    retryDelay: 1000,
    placeholderData: { success: true, studyIds: [] }
  });

  // Mutation for generating a single image
  const singleImageMutation = useMutation<ImageGenerationResponse, Error, number>({
    mutationFn: async (studyId: number) => {
      const response = await apiRequest({
        url: `/api/image-generation/generate/${studyId}`,
        method: "POST"
      });
      return response as unknown as ImageGenerationResponse;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/image-generation/find-studies-needing-images"] });
      toast({
        title: "Image Generated",
        description: `Successfully generated image for study #${data.studyId || variables}`,
        variant: "default",
      });
      setSelectedStudyId(null);
    },
    onError: (error) => {
      console.error("Error generating image:", error);
      toast({
        title: "Error",
        description: "Failed to generate image. Please try again.",
        variant: "destructive",
      });
      setSelectedStudyId(null);
    }
  });

  // Mutation for batch generating images
  const batchImageMutation = useMutation<BatchImageResponse, Error, number>({
    mutationFn: async (size: number) => {
      const response = await apiRequest({
        url: "/api/image-generation/batch-generate",
        method: "POST",
        data: { limit: size }
      });
      return response as unknown as BatchImageResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/image-generation/find-studies-needing-images"] });
      toast({
        title: "Batch Processing Started",
        description: `Started processing ${data.studyIds?.length || 0} studies. This will run in the background.`,
        variant: "default",
      });
    },
    onError: (error) => {
      console.error("Error batch generating images:", error);
      toast({
        title: "Error",
        description: "Failed to start batch image generation. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Mutation for auto-generating images for all studies without images
  const autoGenImageMutation = useMutation<BatchImageResponse, Error, void>({
    mutationFn: async () => {
      const response = await apiRequest({
        url: "/api/image-generation/auto-generate-all",
        method: "POST"
      });
      return response as unknown as BatchImageResponse;
    },
    onSuccess: (data) => {
      setAutoGenStarted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/image-generation/find-studies-needing-images"] });
      toast({
        title: "Auto-Generation Started",
        description: data.message || "Started generating images for all studies that need them. This process will run in the background.",
        variant: "default",
      });
    },
    onError: (error) => {
      console.error("Error starting auto image generation:", error);
      toast({
        title: "Error",
        description: "Failed to start auto image generation. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Handle single image generation for a study
  const handleGenerateImage = (studyId: number) => {
    setSelectedStudyId(studyId);
    singleImageMutation.mutate(studyId);
  };

  const handleBatchGenerate = () => {
    batchImageMutation.mutate(batchSize);
  };
  
  const handleAutoGenerate = () => {
    if (confirm("This will start generating images for ALL studies without images. The process will run in the background and may take a significant amount of time. Do you want to continue?")) {
      autoGenImageMutation.mutate();
    }
  };

  return (
    <AdminLayout title="Image Generation" description="Generate scientific images for studies without media">      
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
                `${studiesNeedingImages?.studyIds?.length || 0} studies need images`
              )}
            </p>
            <Button onClick={() => refetchStudies()} variant="outline" className="w-full">
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
              onClick={handleBatchGenerate} 
              disabled={batchImageMutation.isPending || !studiesNeedingImages?.studyIds?.length}
              className="w-full"
            >
              {batchImageMutation.isPending ? (
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
                  Image generation is running in the background. This process may take some time to complete.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">
                  This will find all studies without images and generate AI visuals for them in the background.
                </p>
                <Button 
                  onClick={handleAutoGenerate} 
                  disabled={autoGenImageMutation.isPending}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {autoGenImageMutation.isPending ? (
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
      ) : (!studiesNeedingImages?.studyIds || studiesNeedingImages?.studyIds?.length === 0) ? (
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
          {studiesNeedingImages?.studyIds?.map((studyId: number) => (
            <Card key={studyId}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Study #{studyId}</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      Missing Image
                    </p>
                  </div>
                  <Button
                    onClick={() => handleGenerateImage(studyId)}
                    disabled={singleImageMutation.isPending && selectedStudyId === studyId}
                    size="sm"
                    className="shrink-0"
                  >
                    {singleImageMutation.isPending && selectedStudyId === studyId ? (
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