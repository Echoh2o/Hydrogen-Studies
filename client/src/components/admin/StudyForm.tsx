import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Save } from "lucide-react";
import { Category } from "@/types";
import { MediaUpload } from "@/components/common/MediaUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Study form schema
const studySchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  abstract: z.string().min(10, "Abstract must be at least 10 characters"),
  authors: z.string().min(2, "Authors must be specified"),
  journal: z.string().min(2, "Journal must be specified"),
  publishDate: z.string().refine(date => !isNaN(Date.parse(date)), {
    message: "Please enter a valid date"
  }),
  category: z.string().min(1, "Please select a category"),
  methods: z.string().optional(),
  results: z.string().optional(),
  conclusion: z.string().optional(),
  doi: z.string().optional().or(z.literal("")),
  pdfUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  citationUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  peerReviewed: z.boolean().default(false)
});

type StudyFormValues = z.infer<typeof studySchema>;

interface StudyFormProps {
  studyId?: number;
  onSuccess?: () => void;
}

export default function StudyForm({ studyId, onSuccess }: StudyFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdStudyId, setCreatedStudyId] = useState<number | undefined>(studyId);
  
  // Fetch categories for dropdown
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    staleTime: 300000, // 5 minutes
  });
  
  // If editing, fetch study data
  const { data: studyData } = useQuery({
    queryKey: [`/api/studies/${studyId}`],
    enabled: !!studyId,
  });
  
  // Initialize form with default values or existing study data
  const form = useForm<StudyFormValues>({
    resolver: zodResolver(studySchema),
    defaultValues: {
      title: studyData?.title || "",
      abstract: studyData?.abstract || "",
      authors: studyData?.authors || "",
      journal: studyData?.journal || "",
      publishDate: studyData?.publishDate 
        ? new Date(studyData.publishDate).toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0],
      category: studyData?.category || "",
      methods: studyData?.methods || "",
      results: studyData?.results || "",
      conclusion: studyData?.conclusion || "",
      doi: studyData?.doi || "",
      pdfUrl: studyData?.pdfUrl || "",
      citationUrl: studyData?.citationUrl || "",
      peerReviewed: studyData?.peerReviewed || false
    },
    values: studyData && {
      ...studyData,
      publishDate: new Date(studyData.publishDate).toISOString().split('T')[0]
    }
  });
  
  // Create/Update study mutation
  const studyMutation = useMutation({
    mutationFn: async (data: StudyFormValues) => {
      if (studyId) {
        // Update existing study
        const response = await apiRequest("PUT", `/api/studies/${studyId}`, data);
        return response.json();
      } else {
        // Create new study
        const response = await apiRequest("POST", "/api/studies", data);
        return response.json();
      }
    },
    onSuccess: (data) => {
      toast({
        title: studyId ? "Study updated" : "Study created",
        description: studyId 
          ? "The study was successfully updated" 
          : "The study was successfully created",
      });
      
      // Save the created study ID for the media upload section
      if (!studyId && data && data.id) {
        setCreatedStudyId(data.id);
      }
      
      // Invalidate studies queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
      
      // Reset form if creating new study
      if (!studyId) {
        form.reset({
          title: "",
          abstract: "",
          authors: "",
          journal: "",
          publishDate: new Date().toISOString().split('T')[0],
          category: "",
          methods: "",
          results: "",
          conclusion: "",
          doi: "",
          pdfUrl: "",
          citationUrl: "",
          peerReviewed: false
        });
      }
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save study",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });
  
  // Function to auto-fetch data from DOI or PMID
  const [isFetchingData, setIsFetchingData] = useState(false);
  
  const handleAutoFetchData = async () => {
    const doiValue = form.getValues("doi");
    
    if (!doiValue) {
      toast({
        title: "Missing information",
        description: "Please enter a DOI or PMID to auto-fetch data",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsFetchingData(true);
      
      // Call API to fetch study details
      const response = await apiRequest("POST", "/api/studies/fetch-details", {
        identifier: doiValue
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch study details");
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Update form with fetched data
        form.setValue("title", data.study.title || form.getValues("title"));
        form.setValue("abstract", data.study.abstract || form.getValues("abstract"));
        form.setValue("authors", data.study.authors || form.getValues("authors"));
        form.setValue("journal", data.study.journal || form.getValues("journal"));
        form.setValue("publishDate", data.study.publishDate || form.getValues("publishDate"));
        form.setValue("pdfUrl", data.study.pdfUrl || form.getValues("pdfUrl"));
        form.setValue("citationUrl", data.study.citationUrl || form.getValues("citationUrl"));
        
        if (data.study.methods) form.setValue("methods", data.study.methods);
        if (data.study.results) form.setValue("results", data.study.results);
        if (data.study.conclusion) form.setValue("conclusion", data.study.conclusion);
        
        toast({
          title: "Data fetched successfully",
          description: "Study information has been updated",
        });
      } else {
        toast({
          title: "Could not find study",
          description: data.message || "No information found for this DOI/PMID",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error fetching data",
        description: error.message || "Failed to fetch study details",
        variant: "destructive",
      });
    } finally {
      setIsFetchingData(false);
    }
  };

  // Form submission handler
  const onSubmit = (values: StudyFormValues) => {
    setIsSubmitting(true);
    studyMutation.mutate(values);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Study Title</FormLabel>
                <FormControl>
                  <Input placeholder="Enter study title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Abstract */}
          <FormField
            control={form.control}
            name="abstract"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Abstract</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Enter study abstract" 
                    className="min-h-[120px]" 
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Authors */}
          <FormField
            control={form.control}
            name="authors"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Authors</FormLabel>
                <FormControl>
                  <Input placeholder="Author names, separated by commas" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Journal */}
          <FormField
            control={form.control}
            name="journal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Journal</FormLabel>
                <FormControl>
                  <Input placeholder="Journal name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Publish Date */}
          <FormField
            control={form.control}
            name="publishDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Publish Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Category */}
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Methods */}
          <FormField
            control={form.control}
            name="methods"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Methods</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Study methods (optional)" 
                    className="min-h-[100px]" 
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Results */}
          <FormField
            control={form.control}
            name="results"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Results</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Study results (optional)" 
                    className="min-h-[100px]" 
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Conclusion */}
          <FormField
            control={form.control}
            name="conclusion"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Conclusion</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Study conclusion (optional)" 
                    className="min-h-[100px]" 
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* DOI */}
          <FormField
            control={form.control}
            name="doi"
            render={({ field }) => (
              <FormItem>
                <FormLabel>DOI or PMID</FormLabel>
                <div className="flex space-x-2">
                  <FormControl>
                    <Input placeholder="Digital Object Identifier or PubMed ID" {...field} value={field.value || ""} />
                  </FormControl>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleAutoFetchData}
                    disabled={isFetchingData || !field.value}
                  >
                    {isFetchingData ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      "Auto-Complete"
                    )}
                  </Button>
                </div>
                <FormDescription>
                  Enter a DOI or PubMed ID to auto-fetch missing information
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* PDF URL */}
          <FormField
            control={form.control}
            name="pdfUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PDF URL</FormLabel>
                <FormControl>
                  <Input placeholder="URL to PDF document (optional)" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Citation URL */}
          <FormField
            control={form.control}
            name="citationUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Citation URL</FormLabel>
                <FormControl>
                  <Input placeholder="URL to citation (optional)" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Peer Reviewed */}
          <FormField
            control={form.control}
            name="peerReviewed"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Peer Reviewed</FormLabel>
                  <FormDescription>
                    Check this if the study has been peer reviewed
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>
        
        {/* Submit Button */}
        <Button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full md:w-auto"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {studyId ? "Updating..." : "Creating..."}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {studyId ? "Update Study" : "Create Study"}
            </>
          )}
        </Button>
      </form>
      
      {/* Media Upload Section - Only shown after study is created or when editing */}
      {createdStudyId && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Media Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="image" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="image">Images</TabsTrigger>
                <TabsTrigger value="video">Video</TabsTrigger>
                <TabsTrigger value="audio">Audio</TabsTrigger>
              </TabsList>
              
              <TabsContent value="image" className="space-y-4">
                <p className="text-sm text-muted-foreground">Upload images related to this study. The first image uploaded will be used as the main image.</p>
                <MediaUpload 
                  entityId={createdStudyId} 
                  entityType="study"
                  onSuccess={(mediaUrl) => {
                    toast({
                      title: "Image uploaded",
                      description: "The image has been successfully uploaded and linked to this study."
                    });
                    queryClient.invalidateQueries({ queryKey: [`/api/studies/${createdStudyId}`] });
                  }}
                />
              </TabsContent>
              
              <TabsContent value="video" className="space-y-4">
                <p className="text-sm text-muted-foreground">Upload a video presentation or explanation of this study.</p>
                <MediaUpload 
                  entityId={createdStudyId} 
                  entityType="study"
                  onSuccess={(mediaUrl) => {
                    toast({
                      title: "Video uploaded",
                      description: "The video has been successfully uploaded and linked to this study."
                    });
                    queryClient.invalidateQueries({ queryKey: [`/api/studies/${createdStudyId}`] });
                  }}
                />
              </TabsContent>
              
              <TabsContent value="audio" className="space-y-4">
                <p className="text-sm text-muted-foreground">Upload audio files such as interviews or podcasts related to this study.</p>
                <MediaUpload 
                  entityId={createdStudyId} 
                  entityType="study"
                  onSuccess={(mediaUrl) => {
                    toast({
                      title: "Audio uploaded",
                      description: "The audio file has been successfully uploaded and linked to this study."
                    });
                    queryClient.invalidateQueries({ queryKey: [`/api/studies/${createdStudyId}`] });
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </Form>
  );
}