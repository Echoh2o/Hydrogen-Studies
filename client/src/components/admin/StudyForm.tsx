import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { WysiwygEditor } from '@/components/ui/wysiwyg-editor';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Form schema
const studyFormSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters' }),
  authors: z.string().min(3, { message: 'Authors are required' }),
  abstract: z.string().min(10, { message: 'Abstract must be at least 10 characters' }),
  journal: z.string().min(2, { message: 'Journal is required' }),
  publishDate: z.date({ required_error: 'Publication date is required' }),
  category: z.string().min(1, { message: 'Category is required' }),
  peerReviewed: z.boolean().default(false),
  methods: z.string().optional(),
  results: z.string().optional(),
  conclusion: z.string().optional(),
  doi: z.string().optional(),
  pdfUrl: z.string().optional(),
  citationUrl: z.string().optional(),
});

type StudyFormValues = z.infer<typeof studyFormSchema>;

interface StudyFormProps {
  initialData?: Partial<StudyFormValues>;
  studyId?: number;
  onSuccess?: () => void;
}

export default function StudyForm({ initialData, studyId, onSuccess }: StudyFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Default values for the form
  const defaultValues: Partial<StudyFormValues> = {
    title: initialData?.title || '',
    abstract: initialData?.abstract || '',
    authors: initialData?.authors || '',
    journal: initialData?.journal || '',
    publishDate: initialData?.publishDate ? new Date(initialData.publishDate) : new Date(),
    peerReviewed: initialData?.peerReviewed || false,
    category: initialData?.category || '',
    methods: initialData?.methods || '',
    results: initialData?.results || '',
    conclusion: initialData?.conclusion || '',
    doi: initialData?.doi || '',
    pdfUrl: initialData?.pdfUrl || '',
    citationUrl: initialData?.citationUrl || '',
  };
  
  // Initialize form
  const form = useForm<StudyFormValues>({
    resolver: zodResolver(studyFormSchema),
    defaultValues,
  });
  
  // Create or update study mutation
  const studyMutation = useMutation({
    mutationFn: async (data: StudyFormValues) => {
      const endpoint = studyId 
        ? `/api/studies/${studyId}` 
        : '/api/studies';
      
      const method = studyId ? 'PUT' : 'POST';
      const formattedData = {
        ...data,
        publishDate: format(data.publishDate, 'yyyy-MM-dd'),
      };
      
      const response = await apiRequest(method, endpoint, formattedData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: studyId ? "Study Updated" : "Study Created",
        description: studyId
          ? "The study has been updated successfully."
          : "The study has been created successfully.",
      });
      
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: any) => {
      console.error("Error submitting study:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });
  
  // Form submission handler
  const onSubmit = (values: StudyFormValues) => {
    setIsSubmitting(true);
    studyMutation.mutate(values);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information Section */}
        <div>
          <h3 className="text-lg font-medium">Basic Information</h3>
          <p className="text-sm text-gray-500 mb-4">
            Enter the core details about the study.
          </p>
          
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title*</FormLabel>
                  <FormControl>
                    <Input placeholder="Study title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="authors"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Authors*</FormLabel>
                  <FormControl>
                    <Input placeholder="Smith J, Johnson A, et al." {...field} />
                  </FormControl>
                  <FormDescription>
                    Author names separated by commas
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="abstract"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abstract*</FormLabel>
                  <FormControl>
                    <WysiwygEditor
                      id="abstract"
                      name="abstract"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Study abstract"
                      height="200px"
                      required
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="journal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Journal*</FormLabel>
                    <FormControl>
                      <Input placeholder="Journal name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="publishDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Publication Date*</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category*</FormLabel>
                  <FormControl>
                    <Input placeholder="Category" {...field} />
                  </FormControl>
                  <FormDescription>
                    Primary research category (e.g., Metabolism, Neurology)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
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
                      Check if this study has been peer-reviewed
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </div>
        
        <Separator />
        
        {/* Study Details Section */}
        <div>
          <h3 className="text-lg font-medium">Study Details</h3>
          <p className="text-sm text-gray-500 mb-4">
            Add more detailed information about the study's methodology and findings.
          </p>
          
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="methods"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Methods</FormLabel>
                  <FormControl>
                    <WysiwygEditor
                      id="methods"
                      name="methods"
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Study methods"
                      height="180px"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="results"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Results</FormLabel>
                  <FormControl>
                    <WysiwygEditor
                      id="results"
                      name="results"
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Study results"
                      height="180px"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="conclusion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conclusion</FormLabel>
                  <FormControl>
                    <WysiwygEditor
                      id="conclusion"
                      name="conclusion"
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Study conclusion"
                      height="180px"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        <Separator />
        
        {/* Links and References Section */}
        <div>
          <h3 className="text-lg font-medium">Links and References</h3>
          <p className="text-sm text-gray-500 mb-4">
            Add links to the original study and related resources.
          </p>
          
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="doi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>DOI</FormLabel>
                  <FormControl>
                    <Input placeholder="10.1000/xyz123" {...field} />
                  </FormControl>
                  <FormDescription>
                    Digital Object Identifier for the study
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="pdfUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PDF URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/study.pdf" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="citationUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Citation URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://pubmed.ncbi.nlm.nih.gov/12345678/" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={isSubmitting}
          >
            Reset
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {studyId ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              studyId ? 'Update Study' : 'Create Study'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}