import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  HiTag, 
  HiHeart, 
  HiUser, 
  HiAcademicCap, 
  HiCurrencyDollar, 
  HiGlobe, 
  HiDocumentText,
  HiTrendingUp,
  HiExternalLink,
  HiClock,
  HiBeaker,
  HiCheck
} from "react-icons/hi";
import { type studies } from "@shared/schema";

type Study = typeof studies.$inferSelect;

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

  const keywords = Array.isArray(study.keywords) ? study.keywords : parseJsonField(study.keywords || '');
  
  // Use health conditions and body systems instead of outdated consumer categories
  const healthCategories = [];
  if ((study as any).health_conditions && (study as any).health_conditions !== 'General Wellness') {
    healthCategories.push((study as any).health_conditions);
  }
  if ((study as any).body_systems && (study as any).body_systems !== 'General Wellness') {
    healthCategories.push((study as any).body_systems);
  }
  if (study.category && study.category !== 'General Wellness') {
    healthCategories.push(study.category);
  }
  
  const consumerCategories = healthCategories.length > 0 ? healthCategories : [];
  
  // Parse funding sources
  const fundingSources = study.fundingSources ? 
    study.fundingSources.split(';').map(source => source.trim()).filter(Boolean) : [];
    
  // Parse author affiliations
  const authorAffiliations = study.authorAffiliations ? 
    study.authorAffiliations.split(';').map(affil => affil.trim()).filter(Boolean) : [];

  // Fetch real data counts
  const { data: keywordCounts } = useQuery({
    queryKey: ['/api/metadata/keywords/counts'],
    enabled: keywords.length > 0
  });

  const { data: categoryCounts } = useQuery({
    queryKey: ['/api/metadata/consumer-categories/counts'],
    enabled: consumerCategories.length > 0
  });

  const { data: relatedStudiesData } = useQuery({
    queryKey: ['/api/metadata/related', study.id],
    queryFn: async () => {
      const response = await fetch(`/api/metadata/related/${study.id}`);
      if (!response.ok) throw new Error('Failed to fetch related studies');
      return response.json();
    },
    enabled: !!study.id
  });

  // Create clickable info items with authentic counts
  const InfoSection = ({ 
    title, 
    icon: Icon, 
    items, 
    linkPrefix,
    countsData,
    emptyMessage = "Not specified"
  }: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    items: string[];
    linkPrefix: string;
    countsData?: Array<{ keyword?: string; category?: string; count: number }>;
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

    const getCount = (item: string) => {
      if (!countsData) return 1;
      const match = countsData.find(c => 
        (c.keyword && c.keyword.toLowerCase() === item.toLowerCase()) ||
        (c.category && c.category.toLowerCase() === item.toLowerCase())
      );
      return match?.count || 1;
    };

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
                  ({getCount(item)})
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
            countsData={keywordCounts}
            emptyMessage="Keywords being processed from research paper"
          />
          
          <Separator />
          
          <InfoSection
            title="Health Categories"
            icon={HiHeart}
            items={consumerCategories}
            linkPrefix="/category/"
            countsData={categoryCounts}
            emptyMessage="No specific health categories"
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
                  {study.citationCount || 0}
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
          {/* Study Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
              <HiDocumentText className="w-4 h-4" />
              Study Information
            </div>
            
            <div className="space-y-2">
              <div>
                <span className="text-xs text-neutral-500">Title:</span>
                <p className="text-xs text-neutral-800 font-medium leading-relaxed">
                  {study.title}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-neutral-500">Author(s):</span>
                  <p className="text-xs text-neutral-700">
                    {study.authors}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-neutral-500">Date:</span>
                  <p className="text-xs text-neutral-700">
                    {study.publishDate || study.journalPublishDate || 'Not specified'}
                  </p>
                </div>
              </div>
              
              {study.doi && (
                <div>
                  <span className="text-xs text-neutral-500">DOI:</span>
                  <p className="text-xs text-blue-600 font-mono">
                    {study.doi}
                  </p>
                </div>
              )}
              
              {(study.url || study.doi) && (
                <div>
                  <a 
                    href={study.url || `https://doi.org/${study.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <HiExternalLink className="w-3 h-3" />
                    View Original Study
                  </a>
                </div>
              )}
            </div>
          </div>

          <Separator />

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
              {study.publishYear && (
                <p className="text-xs text-neutral-500">
                  Published: {study.publishYear}
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
                      {relatedStudy.journal} • {relatedStudy.publishYear}
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

      {/* Similar Studies */}
      {relatedStudiesData && relatedStudiesData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Similar Studies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {relatedStudiesData.slice(0, 4).map((relatedStudy: any) => (
                <Link key={relatedStudy.id} href={`/study/${relatedStudy.slug || relatedStudy.id}`}>
                  <div className="p-3 border border-neutral-200 rounded-lg hover:border-primary hover:bg-neutral-50 transition-colors cursor-pointer">
                    <h4 className="text-sm font-medium line-clamp-2 mb-1">
                      {relatedStudy.plainLanguageTitle || relatedStudy.title}
                    </h4>
                    <p className="text-xs text-neutral-500">
                      {relatedStudy.journal} • {relatedStudy.publishDate?.slice(0, 4) || relatedStudy.journalPublishDate?.slice(0, 4) || 'Year not specified'}
                    </p>
                  </div>
                </Link>
              ))}
              {relatedStudiesData.length > 4 && (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/search?related=${study.id}`}>
                    View All {relatedStudiesData.length} Similar Studies
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Study Methodology */}
      {((study as any).sample_size || (study as any).duration || (study as any).vehicle || (study as any).ph) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Study Methodology</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(study as any).sample_size && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Sample Size:</span>
                  <Badge variant="outline" className="text-xs">
                    {(study as any).sample_size}
                  </Badge>
                </div>
              )}
              {(study as any).duration && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Duration:</span>
                  <Badge variant="outline" className="text-xs">
                    {(study as any).duration}
                  </Badge>
                </div>
              )}
              {(study as any).vehicle && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Delivery Method:</span>
                  <Badge variant="outline" className="text-xs">
                    {(study as any).vehicle}
                  </Badge>
                </div>
              )}
              {(study as any).ph && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">pH Level:</span>
                  <Badge variant="outline" className="text-xs">
                    {(study as any).ph}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Study Quality Indicators */}
      {((study as any).citation_count > 0 || (study as any).peer_reviewed || (study as any).has_full_text) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quality Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(study as any).peer_reviewed && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-neutral-700">Peer Reviewed</span>
                </div>
              )}
              {(study as any).citation_count > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Citations:</span>
                  <Badge variant="outline" className="text-xs">
                    {(study as any).citation_count}
                  </Badge>
                </div>
              )}
              {(study as any).has_full_text && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-neutral-700">Full Text Available</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Geographic Information */}
      {((study as any).country || (study as any).region) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Geographic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(study as any).country && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Country:</span>
                  <Badge variant="outline" className="text-xs">
                    {(study as any).country}
                  </Badge>
                </div>
              )}
              {(study as any).region && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Region:</span>
                  <Badge variant="outline" className="text-xs">
                    {(study as any).region}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}