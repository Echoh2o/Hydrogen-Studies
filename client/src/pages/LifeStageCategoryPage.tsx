import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Baby, Calendar, Book, ArrowLeft, Loader2, User, School, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Helmet } from "react-helmet";

interface Study {
  id: number;
  title: string;
  abstract: string;
  publishDate: string;
  journal: string;
  doi?: string | null;
  fullText?: string | null;
  methods?: string | null;
  results?: string | null;
  conclusions?: string | null;
  imageUrl?: string | null;
}

const LifeStageCategoryPage = () => {
  const { name } = useParams();
  const decodedName = name ? decodeURIComponent(name) : '';
  const displayName = decodedName.charAt(0).toUpperCase() + decodedName.slice(1);
  
  const [studies, setStudies] = useState<Study[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch studies for this life stage
  useEffect(() => {
    const fetchStudies = async () => {
      setIsLoading(true);
      try {
        // Use the consumer categories API with the model set to 'life_stage'
        const response = await fetch(`/api/consumer-categories/studies?model=life_stage&category=${encodeURIComponent(displayName)}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setStudies(data.data);
            console.log("Studies for life stage:", data.data);
          } else {
            console.warn("No studies found or invalid response format:", data);
            setStudies([]);
          }
        } else {
          console.error("Failed API response:", response.status, response.statusText);
          setError("Failed to load studies for this life stage");
          setStudies([]);
        }
      } catch (err) {
        console.error(`Error fetching studies for ${displayName}:`, err);
        setError("Error loading studies. Please try again.");
        setStudies([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (displayName) {
      fetchStudies();
    }
  }, [displayName]);

  // Format a date string to a readable format
  const formatDate = (dateString: string) => {
    if (!dateString) return "Date unknown";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Truncate text if it's too long
  const truncateText = (text: string, maxLength: number = 200) => {
    if (!text) return "No abstract available";
    return text.length > maxLength 
      ? `${text.substring(0, maxLength)}...` 
      : text;
  };

  // Get icon and color based on life stage name
  const getLifeStageIcon = () => {
    switch(displayName) {
      case "Infants & Newborns":
        return <Baby className="h-8 w-8 text-blue-400" />;
      case "Children & Adolescents":
        return <School className="h-8 w-8 text-green-500" />;
      case "Adults":
        return <User className="h-8 w-8 text-purple-500" />;
      case "Older Adults":
        return <CalendarClock className="h-8 w-8 text-amber-600" />;
      // Add more cases for other demographics
      default:
        return <User className="h-8 w-8 text-primary" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Helmet>
        <title>{displayName} Hydrogen Studies | HydrogenStudies.com</title>
        <meta 
          name="description" 
          content={`Research studies about how hydrogen therapy may affect ${displayName.toLowerCase()}. Browse the latest scientific evidence and findings.`}
        />
      </Helmet>

      <div className="mb-8">
        <Link href="/explore-by-life-stage">
          <Button variant="ghost" className="px-0 text-primary hover:text-primary/80 hover:bg-transparent">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to All Life Stages
          </Button>
        </Link>
      </div>

      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-primary mb-4 flex items-center justify-center">
          <div className="mr-3">
            {getLifeStageIcon()}
          </div>
          Hydrogen Studies for {displayName}
        </h1>
        <p className="text-neutral-600 max-w-2xl mx-auto">
          Explore scientific research investigating the effects of hydrogen therapy on {displayName.toLowerCase()}. 
          Learn about methodologies, results, and key findings.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-neutral-700">Loading studies...</span>
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-red-500">Error loading studies. Please try again.</p>
        </div>
      ) : (
        <>
          {studies.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {studies.map((study) => (
                <Card key={study.id} className="overflow-hidden hover:shadow-md transition-shadow duration-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">{study.title}</CardTitle>
                    <div className="flex items-center text-sm text-neutral-500 mt-2">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>{formatDate(study.publishDate)}</span>
                      {study.journal && (
                        <>
                          <span className="mx-2">•</span>
                          <Book className="h-4 w-4 mr-1" />
                          <span>{study.journal}</span>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-neutral-700">
                      {truncateText(study.abstract)}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Link href={`/studies/${study.id}`}>
                      <Button>View Full Study</Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-neutral-50 rounded-lg border border-neutral-200">
              <User className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-neutral-700 mb-2">No Studies Found</h2>
              <p className="text-neutral-600 max-w-md mx-auto">
                We don't have any studies categorized for {displayName} yet. 
                Check back later as we're continually updating our research database.
              </p>
            </div>
          )}

          <div className="mt-16 p-6 bg-neutral-50 rounded-lg border border-neutral-200">
            <h2 className="text-xl font-semibold text-primary mb-4">About {displayName} Studies</h2>
            <p className="text-neutral-600 mb-4">
              Research on hydrogen therapy for {displayName.toLowerCase()} explores how molecular hydrogen's 
              potential benefits may be particularly relevant to this demographic. Studies investigate 
              safety, efficacy, and specific applications for this group.
            </p>
            <p className="text-neutral-600">
              Our database is regularly updated with new research as it becomes available. If you're a 
              researcher in this field, please contact us to contribute your work to our database.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default LifeStageCategoryPage;