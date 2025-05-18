import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Helmet } from "react-helmet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DetailSkeleton, ErrorDisplay, EmptyState } from "@/components/ui/loading-states";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { formatDate } from "@/lib/utils";
import { Study } from "@/types";
import { 
  ArrowLeft, Calendar, User, BookOpen, FileText, 
  Link as LinkIcon, Download, FileQuestion, Share2,
  ExternalLink
} from "lucide-react";
import ResearchInsightCard from "@/components/sharing/ResearchInsightCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// StudyContent component to display the study details
const StudyContent = ({ study }: { study: Study }) => {
  return (
    <>
      <Helmet>
        <title>{study.title} | Hydrogen Studies</title>
        <meta name="description" content={study.abstract.substring(0, 160)} />
        <meta property="og:title" content={study.title} />
        <meta property="og:description" content={study.abstract.substring(0, 160)} />
        <meta property="og:type" content="article" />
      </Helmet>

      <div className="bg-white rounded-xl p-8 shadow-sm">
        <Badge variant="outline" className={getCategoryColor(study.category)}>
          {study.category}
        </Badge>
        
        <h1 className="text-2xl md:text-3xl font-bold mt-4 mb-6">{study.title}</h1>
        
        <div className="flex flex-wrap gap-4 text-sm text-neutral-600 mb-6">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2" />
            <span>Published: {formatDate(study.publishDate)}</span>
          </div>
          <div className="flex items-center">
            <User className="h-4 w-4 mr-2" />
            <span>{study.authors}</span>
          </div>
          <div className="flex items-center">
            <BookOpen className="h-4 w-4 mr-2" />
            <span>{study.journal}</span>
          </div>
        </div>
        
        <Tabs defaultValue="content" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="content">Study Content</TabsTrigger>
            <TabsTrigger value="share" className="flex items-center gap-1">
              <Share2 className="h-4 w-4" />
              Share Insights
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="content">
            <Separator className="mb-6" />
            
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-3">Abstract</h2>
                <div className="text-neutral-700 leading-relaxed whitespace-pre-line">{study.abstract}</div>
              </div>
              
              {study.methods && (
                <div>
                  <h2 className="text-xl font-bold mb-3">Methods</h2>
                  <div className="text-neutral-700 leading-relaxed whitespace-pre-line">{study.methods}</div>
                </div>
              )}
              
              {study.results && (
                <div>
                  <h2 className="text-xl font-bold mb-3">Results</h2>
                  <div className="text-neutral-700 leading-relaxed whitespace-pre-line">{study.results}</div>
                </div>
              )}
              
              {study.conclusion && (
                <div>
                  <h2 className="text-xl font-bold mb-3">Conclusion</h2>
                  <div className="text-neutral-700 leading-relaxed whitespace-pre-line">{study.conclusion}</div>
                </div>
              )}
              
              <div>
                <h2 className="text-xl font-bold mb-3">Links & Resources</h2>
                <div className="flex flex-wrap gap-3">
                  {study.doi && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex items-center gap-2"
                      onClick={() => window.open(`https://doi.org/${study.doi}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Original Paper
                    </Button>
                  )}
                  
                  {study.pdfUrl && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex items-center gap-2"
                      onClick={() => window.open(study.pdfUrl, '_blank')}
                    >
                      <FileText className="h-4 w-4" />
                      View PDF
                    </Button>
                  )}
                  
                  {study.citationUrl && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex items-center gap-2"
                      onClick={() => window.open(study.citationUrl, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                      Download Citation
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="share">
            <Separator className="mb-6" />
            <div className="p-2">
              <ResearchInsightCard study={study} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

// Helper function to determine the color for category badges
const getCategoryColor = (category: string) => {
  switch (category.toLowerCase()) {
    case 'cardiovascular':
      return 'bg-secondary/10 text-secondary border-secondary/20';
    case 'neurology':
    case 'neurodegenerative':
      return 'bg-accent/10 text-accent border-accent/20';
    case 'metabolism':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'inflammation':
      return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'cancer':
      return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    case 'aging':
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  }
};

export default function StudyDetails() {
  const { id } = useParams();
  
  const { data: study, isLoading, isError, error, refetch } = useQuery<Study>({
    queryKey: [`/api/studies/${id}`],
  });
  
  return (
    <div className="bg-neutral-100 py-8 min-h-screen">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <Button 
            variant="ghost" 
            className="mb-4 pl-0 hover:bg-transparent hover:text-primary"
            asChild
          >
            <Link href="/studies">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Studies
            </Link>
          </Button>
          
          <ErrorBoundary>
            {isLoading ? (
              <div className="bg-white rounded-xl p-8 shadow-sm">
                <DetailSkeleton />
              </div>
            ) : isError ? (
              <div className="bg-white rounded-xl p-8 shadow-sm">
                <ErrorDisplay
                  title="Error loading study"
                  message="We're having trouble loading this study. Please try again later."
                  onRetry={() => refetch()}
                />
              </div>
            ) : !study ? (
              <div className="bg-white rounded-xl p-8 shadow-sm text-center">
                <EmptyState
                  title="Study Not Found"
                  description="The study you're looking for doesn't exist or might have been removed."
                  icon={<FileQuestion className="w-12 h-12" />}
                  action={
                    <Link href="/studies">
                      <Button>Browse All Studies</Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              <StudyContent study={study} />
            )}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}