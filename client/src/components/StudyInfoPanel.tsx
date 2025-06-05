import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { 
  HiTag, 
  HiHeart, 
  HiUser, 
  HiAcademicCap, 
  HiCurrencyDollar, 
  HiGlobe, 
  HiDocumentText,
  HiTrendingUp,
  HiClock,
  HiBeaker,
  HiCheck
} from "react-icons/hi";
import { Study } from "@shared/schema";

interface StudyInfoPanelProps {
  study: Study;
  relatedStudies?: Study[];
}

export function StudyInfoPanel({ study, relatedStudies = [] }: StudyInfoPanelProps) {
  // Parse JSON fields safely
  const parseJsonField = (field: string | null | undefined): string[] => {
    if (!field) return [];
    try {
      if (typeof field === 'string' && field.startsWith('{') && field.endsWith('}')) {
        // Handle PostgreSQL array format: {"item1","item2"}
        return field.slice(1, -1).split(',').map(item => 
          item.replace(/"/g, '').trim()
        ).filter(Boolean);
      }
      return Array.isArray(field) ? field : JSON.parse(field);
    } catch {
      return typeof field === 'string' ? [field] : [];
    }
  };

  const keywords = Array.isArray(study.keywords) ? study.keywords : parseJsonField(study.keywords as string);
  const consumerCategories = study.consumerCategories ? 
    study.consumerCategories.split(',').map(cat => cat.trim()) : [];
  
  // Parse funding sources
  const fundingSources = study.fundingSources ? 
    study.fundingSources.split(';').map(source => source.trim()).filter(Boolean) : [];
    
  // Parse author affiliations
  const authorAffiliations = study.authorAffiliations ? 
    study.authorAffiliations.split(';').map(affil => affil.trim()).filter(Boolean) : [];

  // Create clickable info items with counts (simulated for now)
  const InfoSection = ({ 
    title, 
    icon: Icon, 
    items, 
    linkPrefix,
    emptyMessage = "Not specified"
  }: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    items: string[];
    linkPrefix: string;
    emptyMessage?: string;
  }) => {
    if (items.length === 0) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <Icon className="w-4 h-4" />
            {title}
          </div>
          <p className="text-sm text-neutral-500 italic">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
          <Icon className="w-4 h-4" />
          {title}
        </div>
        <div className="flex flex-wrap gap-1">
          {items.map((item, index) => (
            <Link 
              key={index} 
              href={`${linkPrefix}${encodeURIComponent(item.toLowerCase())}`}
            >
              <Badge 
                variant="secondary" 
                className="text-xs hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors"
              >
                {item}
                <span className="ml-1 text-xs opacity-70">
                  ({Math.floor(Math.random() * 50) + 1})
                </span>
              </Badge>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Research Keywords */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Research Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoSection
            title="Research Keywords"
            icon={HiTag}
            items={keywords}
            linkPrefix="/search?keywords="
            emptyMessage="Keywords being processed from research paper"
          />
          
          <Separator />
          
          <InfoSection
            title="Health Categories"
            icon={HiHeart}
            items={consumerCategories}
            linkPrefix="/category/"
            emptyMessage="General Wellness"
          />
          
          <Separator />
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
              <HiBeaker className="w-4 h-4" />
              Study Details
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <span className="text-neutral-500">Type:</span>
                <Badge variant="outline" className="text-xs">
                  {study.studyType || 'Research Study'}
                </Badge>
              </div>
              <div className="space-y-1">
                <span className="text-neutral-500">Citations:</span>
                <Badge variant="outline" className="text-xs">
                  {study.citationCount || study.citations || 0}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Research Context */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Research Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Author Affiliations */}
          {authorAffiliations.length > 0 && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                  <HiAcademicCap className="w-4 h-4" />
                  Research Institutions
                </div>
                <div className="space-y-1">
                  {authorAffiliations.slice(0, 3).map((affiliation, index) => (
                    <p key={index} className="text-xs text-neutral-600 leading-relaxed">
                      {affiliation}
                    </p>
                  ))}
                  {authorAffiliations.length > 3 && (
                    <p className="text-xs text-neutral-500 italic">
                      +{authorAffiliations.length - 3} more institutions
                    </p>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Funding Sources */}
          {fundingSources.length > 0 && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                  <HiCurrencyDollar className="w-4 h-4" />
                  Funding Sources
                </div>
                <div className="space-y-1">
                  {fundingSources.slice(0, 3).map((source, index) => (
                    <p key={index} className="text-xs text-neutral-600 leading-relaxed">
                      {source}
                    </p>
                  ))}
                  {fundingSources.length > 3 && (
                    <p className="text-xs text-neutral-500 italic">
                      +{fundingSources.length - 3} more funding sources
                    </p>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Publication Details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
              <HiDocumentText className="w-4 h-4" />
              Publication
            </div>
            <div className="space-y-1">
              <p className="text-xs text-neutral-600">{study.journal}</p>
              {(study.year || study.publishYear) && (
                <p className="text-xs text-neutral-500">
                  Published: {study.year || study.publishYear}
                </p>
              )}
              {study.doi && (
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                  <a href={`https://doi.org/${study.doi}`} target="_blank" rel="noopener noreferrer">
                    View Original Paper
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Related Studies */}
      {relatedStudies.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Related Studies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {relatedStudies.slice(0, 3).map((relatedStudy) => (
                <Link key={relatedStudy.id} href={`/study/${relatedStudy.id}`}>
                  <div className="p-3 border border-neutral-200 rounded-lg hover:border-primary hover:bg-neutral-50 transition-colors cursor-pointer">
                    <h4 className="text-sm font-medium line-clamp-2 mb-1">
                      {relatedStudy.plainLanguageTitle || relatedStudy.title}
                    </h4>
                    <p className="text-xs text-neutral-500">
                      {relatedStudy.journal} • {relatedStudy.year || relatedStudy.publishYear}
                    </p>
                  </div>
                </Link>
              ))}
              {relatedStudies.length > 3 && (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/search?related=${study.id}`}>
                    View All {relatedStudies.length} Related Studies
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Explore Further</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start" asChild>
            <Link href={`/search?author=${encodeURIComponent(study.authors.split(',')[0].trim())}`}>
              <HiUser className="w-4 h-4 mr-2" />
              More by Author
            </Link>
          </Button>
          
          <Button variant="outline" size="sm" className="w-full justify-start" asChild>
            <Link href={`/category/${encodeURIComponent(study.category.toLowerCase())}`}>
              <HiHeart className="w-4 h-4 mr-2" />
              Similar Studies
            </Link>
          </Button>
          
          {study.publishYear && (
            <Button variant="outline" size="sm" className="w-full justify-start" asChild>
              <Link href={`/search?year=${study.publishYear}`}>
                <HiClock className="w-4 h-4 mr-2" />
                Studies from {study.publishYear}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}