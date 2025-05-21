import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HiArrowLeft, HiDownload, HiExternalLink, HiUser, HiBookOpen, HiCalendar, HiDocumentText, HiClipboardCheck, HiPhotograph } from "react-icons/hi";
import { Helmet } from "react-helmet";
import { useToast } from "@/hooks/use-toast";
import RelatedBlogs from "@/components/studies/related-blogs";

const StudyPage = () => {
  const { id } = useParams();
  const studyId = parseInt(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: study, isLoading, error } = useQuery({
    queryKey: [`/api/studies/${studyId}`],
  });
  
  // Create a fallback image URL for studies
  const fallbackImageUrl = "https://placehold.co/800x400/e2f3ff/003366?text=Hydrogen+Research+Visual";
  
  // Mutation for generating an AI image for this study
  const generateImageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/studies/${studyId}/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate image');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Image generated successfully",
          description: "A new scientific illustration has been created for this study.",
        });
        // Invalidate the study query to refresh the data with the new image
        queryClient.invalidateQueries({ queryKey: [`/api/studies/${studyId}`] });
      } else {
        toast({
          title: "Image generation failed",
          description: data.message || "Unable to generate image. Please try again later.",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Image generation failed",
        description: error instanceof Error ? error.message : "Unable to generate image. Please try again later.",
        variant: "destructive"
      });
    }
  });

  // Related studies query (same category)
  const { data: allStudies } = useQuery({
    queryKey: ["/api/studies"],
  });

  // Get related studies (same category, exclude current)
  const relatedStudies = allStudies
    ? allStudies
        .filter((s: any) => s.category === study?.category && s.id !== studyId)
        .slice(0, 3)
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="h-6 bg-neutral-200 rounded w-48 mb-6 animate-pulse"></div>
            <div className="h-10 bg-neutral-200 rounded w-full mb-4 animate-pulse"></div>
            <div className="flex space-x-4 mb-6">
              <div className="h-6 bg-neutral-200 rounded w-24 animate-pulse"></div>
              <div className="h-6 bg-neutral-200 rounded w-24 animate-pulse"></div>
            </div>
            <div className="space-y-2 mb-8">
              <div className="h-4 bg-neutral-200 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-neutral-200 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-neutral-200 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-neutral-200 rounded w-3/4 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="min-h-screen bg-white py-12">
        <div className="container mx-auto px-4 text-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 pb-6">
              <h1 className="text-xl font-bold mb-4">Study Not Found</h1>
              <p className="text-neutral-600 mb-6">
                {error instanceof Error 
                  ? error.message 
                  : "We couldn't find the study you're looking for. It may have been removed or the ID is incorrect."}
              </p>
              <Link href="/recent">
                <Button>
                  <HiArrowLeft className="mr-2" />
                  Browse Recent Studies
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{study.title} | Hydrogen Studies Research</title>
        <meta name="description" content={`${study.abstract.substring(0, 155)}...`} />
      </Helmet>

      <section className="bg-white py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center text-sm text-neutral-500 mb-6">
              <Link href="/">
                <a className="hover:text-primary">Home</a>
              </Link>
              <span className="mx-2">/</span>
              <Link href="/categories">
                <a className="hover:text-primary">Categories</a>
              </Link>
              <span className="mx-2">/</span>
              <Link href={`/category/${study.category.toLowerCase()}`}>
                <a className="hover:text-primary">{study.category}</a>
              </Link>
              <span className="mx-2">/</span>
              <span className="text-neutral-800">Study</span>
            </div>

            {/* Study Header */}
            <div className="mb-8">
              <div className="flex items-center mb-3">
                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/15">
                  {study.category}
                </Badge>
                <span className="ml-4 text-neutral-500 flex items-center">
                  <HiCalendar className="mr-1" /> {study.year}
                </span>
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold mb-4">{study.title}</h1>
              
              <div className="flex flex-wrap items-center text-neutral-600 gap-y-2">
                <span className="flex items-center mr-6">
                  <HiUser className="mr-1" /> {study.authors}
                </span>
                <span className="flex items-center mr-6">
                  <HiBookOpen className="mr-1" /> {study.journal}
                </span>
                <span className="flex items-center">
                  <HiDocumentText className="mr-1" /> {study.citations || "0"} citations
                </span>
              </div>
            </div>

            {/* Study Content */}
            <div className="bg-white border border-neutral-200 rounded-xl shadow-sm mb-10">
              <div className="p-6 md:p-8">
                {/* Study Image */}
                <div className="mb-6 rounded-lg overflow-hidden">
                  {/* Image with fallback */}
                  <div className="relative">
                    <img 
                      src={study.imageUrl ? study.imageUrl : fallbackImageUrl}
                      alt={`Visual representation of hydrogen research`}
                      className="w-full h-auto object-cover shadow-sm" 
                      onError={(e) => {
                        // Fallback if the image fails to load
                        const target = e.target as HTMLImageElement;
                        target.onerror = null; // Prevent infinite loop
                        target.src = fallbackImageUrl;
                      }}
                    />
                    
                    {/* Generate Image Button - Only show if image is missing or using fallback */}
                    {(!study.imageUrl || study.imageUrl === fallbackImageUrl) && (
                      <div className="absolute bottom-0 left-0 right-0 bg-neutral-800/70 p-3 flex justify-center">
                        <Button 
                          variant="secondary"
                          className="flex items-center gap-2 bg-white hover:bg-neutral-100"
                          onClick={() => generateImageMutation.mutate()}
                          disabled={generateImageMutation.isPending}
                        >
                          <HiPhotograph className="w-4 h-4" />
                          {generateImageMutation.isPending ? 'Generating...' : 'Generate Scientific Visual'}
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-start mt-2">
                    <p className="text-xs text-neutral-500 italic">
                      Visual representation of hydrogen effects related to this research
                    </p>
                    
                    {/* Image attribution if available */}
                    {study.imageAlt && (
                      <span className="text-xs text-neutral-400">
                        {study.imageAlt}
                      </span>
                    )}
                  </div>
                </div>

                <h2 className="text-xl font-semibold mb-4">Abstract</h2>
                <div className="text-neutral-700 mb-8 leading-relaxed whitespace-pre-line">
                  {study.abstract}
                </div>

                {/* Methods, Results, and Conclusion Sections */}
                {study.methods && (
                  <>
                    <h2 className="text-xl font-semibold mb-4">Methods</h2>
                    <div className="text-neutral-700 mb-8 leading-relaxed whitespace-pre-line">
                      {study.methods}
                    </div>
                  </>
                )}
                
                {study.results && (
                  <>
                    <h2 className="text-xl font-semibold mb-4">Results</h2>
                    <div className="text-neutral-700 mb-8 leading-relaxed whitespace-pre-line">
                      {study.results}
                    </div>
                  </>
                )}
                
                {study.conclusion && (
                  <>
                    <h2 className="text-xl font-semibold mb-4">Conclusion</h2>
                    <div className="text-neutral-700 mb-8 leading-relaxed whitespace-pre-line">
                      {study.conclusion}
                    </div>
                  </>
                )}

                <Separator className="my-6" />

                <div className="flex flex-col md:flex-row md:justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-neutral-800 mb-2">Study Details</h3>
                    <ul className="space-y-1 text-sm text-neutral-600">
                      <li>Publication Year: {study.year}</li>
                      {study.studyType && <li>Study Type: {study.studyType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>}
                      <li>Journal: {study.journal}</li>
                      <li>Authors: {study.authors}</li>
                    </ul>
                  </div>
                  
                  <div className="flex flex-col space-y-3">
                    {study.fullTextAvailable ? (
                      <Button className="bg-primary hover:bg-primary-dark text-white">
                        <HiDownload className="mr-2" /> Download Full Text
                      </Button>
                    ) : (
                      <Button variant="outline">
                        <HiExternalLink className="mr-2" /> View on Publisher's Site
                      </Button>
                    )}
                    
                    <Button variant="outline" className="border-neutral-200 hover:border-neutral-300">
                      <HiClipboardCheck className="mr-2" /> Cite this Study
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Related Blogs - AI Generated Articles */}
            <div className="mt-10">
              <div className="mb-10">
                {/* Import the RelatedBlogs component here */}
                {/* @ts-ignore - We'll fix this later */}
                <RelatedBlogs studyId={studyId} />
              </div>
            </div>
            
            {/* Related Studies */}
            {relatedStudies.length > 0 && (
              <div className="mt-10">
                <h2 className="text-2xl font-bold mb-6">Related Studies</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {relatedStudies.map((relatedStudy: any) => (
                    <Link key={relatedStudy.id} href={`/study/${relatedStudy.id}`}>
                      <a className="bg-white border border-neutral-200 rounded-xl shadow-sm hover:shadow-md transition p-4 block">
                        <div className="flex items-center justify-between mb-2">
                          <span className="bg-primary/10 text-primary text-xs font-medium px-2.5 py-0.5 rounded-full">
                            {relatedStudy.category}
                          </span>
                          <span className="text-neutral-500 text-sm">{relatedStudy.year}</span>
                        </div>
                        <h3 className="text-lg font-semibold mb-2 line-clamp-2 hover:text-primary">
                          {relatedStudy.title}
                        </h3>
                        <p className="text-neutral-600 text-sm line-clamp-2 mb-3">
                          {relatedStudy.abstract}
                        </p>
                      </a>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Back navigation */}
            <div className="mt-10 flex justify-between">
              <Link href={`/category/${study.category.toLowerCase()}`}>
                <Button variant="ghost" className="text-neutral-600 hover:text-primary">
                  <HiArrowLeft className="mr-2" /> Back to {study.category} Studies
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default StudyPage;
