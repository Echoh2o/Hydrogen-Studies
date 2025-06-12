
import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { ArrowLeft, Calendar, User, BookOpen, ExternalLink, Share2, Download } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface Study {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  category: string;
  doi: string;
  imageUrl?: string;
  slug: string;
  plainLanguageTitle?: string;
  plainLanguageSummary?: string;
  keyFindings?: string;
  studyType?: string;
  participantCount?: number;
  duration?: string;
  dosage?: string;
  deliveryMethod?: string;
  healthBenefits?: string;
  targetDemographic?: string;
  safetyNotes?: string;
}

export default function StudyDetailsPage() {
  const [match, params] = useRoute('/study/:slug');
  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!match || !params?.slug) return;

    const fetchStudy = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/studies/slug/${params.slug}`);
        
        if (!response.ok) {
          throw new Error('Study not found');
        }
        
        const data = await response.json();
        setStudy(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load study');
      } finally {
        setLoading(false);
      }
    };

    fetchStudy();
  }, [match, params?.slug]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Study Not Found</h1>
            <p className="text-gray-600 mb-6">{error || 'The requested study could not be found.'}</p>
            <Link href="/search">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Search
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: study.plainLanguageTitle || study.title,
          text: study.plainLanguageSummary || study.abstract.substring(0, 200) + '...',
          url: window.location.href,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back Button */}
      <div className="mb-6">
        <Link href="/search">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Search
          </Button>
        </Link>
      </div>

      {/* Study Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row gap-6">
          {study.imageUrl && (
            <div className="md:w-1/3">
              <img
                src={study.imageUrl}
                alt={study.plainLanguageTitle || study.title}
                className="w-full h-48 md:h-64 object-cover rounded-lg shadow-md"
              />
            </div>
          )}
          <div className={study.imageUrl ? "md:w-2/3" : "w-full"}>
            <div className="flex flex-wrap gap-2 mb-3">
              {study.category && (
                <Badge variant="secondary">{study.category}</Badge>
              )}
              {study.studyType && (
                <Badge variant="outline">{study.studyType}</Badge>
              )}
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {study.plainLanguageTitle || study.title}
            </h1>
            
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
              {study.authors && (
                <div className="flex items-center">
                  <User className="mr-1 h-4 w-4" />
                  {study.authors}
                </div>
              )}
              {study.journal && (
                <div className="flex items-center">
                  <BookOpen className="mr-1 h-4 w-4" />
                  {study.journal}
                </div>
              )}
              {study.publishDate && (
                <div className="flex items-center">
                  <Calendar className="mr-1 h-4 w-4" />
                  {new Date(study.publishDate).getFullYear()}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleShare} variant="outline" size="sm">
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              {study.doi && (
                <a
                  href={`https://doi.org/${study.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Original
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Study Content */}
      <div className="space-y-6">
        {/* Plain Language Summary */}
        {study.plainLanguageSummary && (
          <Card>
            <CardHeader>
              <CardTitle>Study Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed">{study.plainLanguageSummary}</p>
            </CardContent>
          </Card>
        )}

        {/* Key Findings */}
        {study.keyFindings && (
          <Card>
            <CardHeader>
              <CardTitle>Key Findings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed">{study.keyFindings}</p>
            </CardContent>
          </Card>
        )}

        {/* Study Details */}
        <Card>
          <CardHeader>
            <CardTitle>Study Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {study.participantCount && (
              <div>
                <h4 className="font-semibold text-gray-900">Participants</h4>
                <p className="text-gray-700">{study.participantCount} participants</p>
              </div>
            )}
            
            {study.duration && (
              <div>
                <h4 className="font-semibold text-gray-900">Duration</h4>
                <p className="text-gray-700">{study.duration}</p>
              </div>
            )}
            
            {study.dosage && (
              <div>
                <h4 className="font-semibold text-gray-900">Dosage</h4>
                <p className="text-gray-700">{study.dosage}</p>
              </div>
            )}
            
            {study.deliveryMethod && (
              <div>
                <h4 className="font-semibold text-gray-900">Delivery Method</h4>
                <p className="text-gray-700">{study.deliveryMethod}</p>
              </div>
            )}
            
            {study.healthBenefits && (
              <div>
                <h4 className="font-semibold text-gray-900">Health Benefits</h4>
                <p className="text-gray-700">{study.healthBenefits}</p>
              </div>
            )}
            
            {study.targetDemographic && (
              <div>
                <h4 className="font-semibold text-gray-900">Target Population</h4>
                <p className="text-gray-700">{study.targetDemographic}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Abstract */}
        <Card>
          <CardHeader>
            <CardTitle>Abstract</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 leading-relaxed">{study.abstract}</p>
          </CardContent>
        </Card>

        {/* Safety Information */}
        {study.safetyNotes && (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardHeader>
              <CardTitle className="text-yellow-800">Safety Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-yellow-700">{study.safetyNotes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
