import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Helmet } from "react-helmet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { Study } from "@/types";
import { ArrowLeft, Calendar, User, BookOpen, FileText, Link as LinkIcon, Download } from "lucide-react";

export default function StudyDetails() {
  const { id } = useParams();
  
  const { data: study, isLoading } = useQuery<Study>({
    queryKey: [`/api/studies/${id}`],
  });
  
  if (isLoading) {
    return (
      <div className="bg-neutral-100 py-8 min-h-screen">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto bg-white rounded-xl p-8 shadow-sm">
            <div className="mb-4">
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-10 w-3/4 mb-4" />
            <div className="flex flex-wrap gap-4 mb-6">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Separator className="my-6" />
            <Skeleton className="h-6 w-1/4 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-6" />
            <Skeleton className="h-6 w-1/4 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-6" />
          </div>
        </div>
      </div>
    );
  }
  
  if (!study) {
    return (
      <div className="bg-neutral-100 py-8 min-h-screen">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto bg-white rounded-xl p-8 shadow-sm">
            <h1 className="text-2xl font-bold mb-4">Study Not Found</h1>
            <p className="mb-6">The study you're looking for doesn't exist or might have been removed.</p>
            <Button asChild>
              <Link href="/studies">Back to Studies</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
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
  
  return (
    <>
      <Helmet>
        <title>{study.title} | Hydrogen Studies</title>
        <meta name="description" content={study.abstract.substring(0, 160)} />
        <meta property="og:title" content={study.title} />
        <meta property="og:description" content={study.abstract.substring(0, 160)} />
        <meta property="og:type" content="article" />
      </Helmet>
      
      <div className="bg-neutral-100 py-8">
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
              
              <Separator className="my-6" />
              
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold mb-3">Abstract</h2>
                  <p className="text-neutral-700 leading-relaxed">{study.abstract}</p>
                </div>
                
                {study.methods && (
                  <div>
                    <h2 className="text-xl font-bold mb-3">Methods</h2>
                    <p className="text-neutral-700 leading-relaxed">{study.methods}</p>
                  </div>
                )}
                
                {study.results && (
                  <div>
                    <h2 className="text-xl font-bold mb-3">Results</h2>
                    <p className="text-neutral-700 leading-relaxed">{study.results}</p>
                  </div>
                )}
                
                {study.conclusion && (
                  <div>
                    <h2 className="text-xl font-bold mb-3">Conclusion</h2>
                    <p className="text-neutral-700 leading-relaxed">{study.conclusion}</p>
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
                        <LinkIcon className="h-4 w-4" />
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
