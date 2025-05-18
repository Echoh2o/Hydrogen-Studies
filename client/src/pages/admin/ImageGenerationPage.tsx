import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Image, Check, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const ImageGenerationPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [batchSize, setBatchSize] = useState<number>(5);
  const [selectedStudyId, setSelectedStudyId] = useState<number | null>(null);

  // Query for studies needing images
  const {
    data: studiesNeedingImages,
    isLoading: isLoadingStudies,
    isError: isErrorStudies,
    refetch: refetchStudies
  } = useQuery({
    queryKey: ["/api/studies/needing-images"],
    retry: false,
  });

  // Mutation for generating a single image
  const singleImageMutation = useMutation({
    mutationFn: (studyId: number) => {
      return apiRequest({
        url: `/api/studies/${studyId}/generate-image`,
        method: "POST"
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies/needing-images"] });
      toast({
        title: "Image Generated",
        description: `Successfully generated image for study #${data.data.studyId}`,
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
  const batchImageMutation = useMutation({
    mutationFn: (size: number) => {
      return apiRequest({
        url: "/api/images/batch-generate",
        method: "POST",
        data: { batchSize: size }
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies/needing-images"] });
      toast({
        title: "Batch Processing Complete",
        description: `Processed ${data.data.processed} studies, ${data.data.success} successful, ${data.data.failed} failed`,
        variant: "default",
      });
    },
    onError: (error) => {
      console.error("Error batch generating images:", error);
      toast({
        title: "Error",
        description: "Failed to process batch image generation. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleGenerateImage = (studyId: number) => {
    setSelectedStudyId(studyId);
    singleImageMutation.mutate(studyId);
  };

  const handleBatchGenerate = () => {
    batchImageMutation.mutate(batchSize);
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
                `${studiesNeedingImages?.data?.length || 0} studies need images`
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
              disabled={batchImageMutation.isPending || !studiesNeedingImages?.data?.length}
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
        
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
            <CardDescription>
              Image generation statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {batchImageMutation.data ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>Processed:</span>
                  <Badge variant="outline">{batchImageMutation.data.data.processed}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Success:</span>
                  <Badge variant="success" className="bg-green-100 text-green-800">{batchImageMutation.data.data.success}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Failed:</span>
                  <Badge variant="destructive">{batchImageMutation.data.data.failed}</Badge>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center">
                No batch processing stats available
              </p>
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
      ) : isErrorStudies ? (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center text-red-600 mb-2">
              <AlertTriangle className="mr-2 h-5 w-5" />
              <h3 className="font-medium">Error Loading Studies</h3>
            </div>
            <p className="text-red-700">
              Failed to load studies needing images. Please try refreshing the page.
            </p>
          </CardContent>
        </Card>
      ) : studiesNeedingImages?.data?.length === 0 ? (
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
          {studiesNeedingImages?.data?.map((study: any) => (
            <Card key={study.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{study.title}</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      {study.category} • {study.publishDate}
                    </p>
                    <p className="text-sm mb-4">
                      {study.abstract || "No abstract available"}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleGenerateImage(study.id)}
                    disabled={singleImageMutation.isPending && selectedStudyId === study.id}
                    size="sm"
                    className="shrink-0"
                  >
                    {singleImageMutation.isPending && selectedStudyId === study.id ? (
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