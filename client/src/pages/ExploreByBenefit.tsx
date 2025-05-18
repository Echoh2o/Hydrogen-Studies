import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useRoute } from 'wouter';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Helmet } from 'react-helmet';

// Icons for benefits
import { Brain, Activity, Heart, Leaf, Shield, Lightbulb, FlameIcon, Sparkles } from 'lucide-react';

const getBenefitIcon = (slug: string, className: string = '') => {
  switch (slug) {
    case 'brain-health':
      return <Brain className={className} />;
    case 'energy-exercise':
      return <Activity className={className} />;
    case 'digestive-health':
      return <Heart className={className} />;
    case 'inflammation-reduction':
      return <FlameIcon className={className} />;
    case 'cellular-protection':
      return <Shield className={className} />;
    case 'metabolic-health':
      return <Leaf className={className} />;
    case 'skin-health':
      return <Sparkles className={className} />;
    case 'pain-relief':
      return <Lightbulb className={className} />;
    default:
      return <Leaf className={className} />;
  }
};

const ExploreByBenefitPage: React.FC = () => {
  // Fetch all benefits
  const { data: benefits, isLoading: benefitsLoading } = useQuery({
    queryKey: ['/api/benefits'],
  });

  return (
    <div className="container mx-auto py-10">
      <Helmet>
        <title>Explore Hydrogen Studies by Benefit | HydrogenStudies.com</title>
        <meta name="description" content="Discover hydrogen research organized by health benefits including brain health, pain relief, skin health, energy, and more." />
      </Helmet>
      
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Explore by Benefit</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find hydrogen research studies organized by the specific health benefits they address
          </p>
        </div>

        {benefitsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array(8).fill(0).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="p-4 pb-2">
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <Skeleton className="h-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits?.map((benefit: any) => (
              <Link key={benefit.id} href={`/benefits/${benefit.slug}`}>
                <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="p-4 pb-2 flex flex-row items-start space-x-4">
                    <div className="bg-primary/10 p-2 rounded-md">
                      {getBenefitIcon(benefit.slug, 'h-6 w-6 text-primary')}
                    </div>
                    <div>
                      <CardTitle className="text-xl">{benefit.name}</CardTitle>
                      <Badge variant="outline" className="mt-1">
                        {benefit.studyCount} studies
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <CardDescription className="line-clamp-3 text-sm">
                      {benefit.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExploreByBenefitPage;

// Detail page for a specific benefit
export const BenefitDetailPage: React.FC = () => {
  const [, params] = useRoute('/benefits/:slug');
  const slug = params?.slug || '';

  // Fetch benefit details
  const { data: benefitData, isLoading: benefitLoading } = useQuery({
    queryKey: [`/api/benefits/${slug}`],
    enabled: !!slug,
  });

  // Fetch studies for this benefit
  const { data: studiesData, isLoading: studiesLoading } = useQuery({
    queryKey: [`/api/benefits/${slug}/studies`],
    enabled: !!slug,
  });

  const benefit = benefitData;
  const studies = studiesData?.studies || [];

  const isLoading = benefitLoading || studiesLoading;

  return (
    <div className="container mx-auto py-10">
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-10 w-3/4 max-w-md" />
          <Skeleton className="h-20 w-full max-w-2xl" />
          <div className="grid grid-cols-1 gap-4">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <Helmet>
            <title>{benefit?.name} | Hydrogen Research | HydrogenStudies.com</title>
            <meta name="description" content={`Explore hydrogen research studies on ${benefit?.name.toLowerCase()} - ${benefit?.description}`} />
          </Helmet>
          
          <div className="mb-8 flex items-center space-x-4">
            <div className="bg-primary/10 p-3 rounded-md">
              {getBenefitIcon(benefit?.slug, 'h-8 w-8 text-primary')}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{benefit?.name}</h1>
              <p className="text-muted-foreground">{benefit?.description}</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-4">Research on {benefit?.name}</h2>
            
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="all">All Studies ({studies.length})</TabsTrigger>
                <TabsTrigger value="clinical">Clinical Studies ({studies.filter((s: any) => s.studyType === 'human').length})</TabsTrigger>
                <TabsTrigger value="preclinical">Preclinical ({studies.filter((s: any) => s.studyType === 'animal' || s.studyType === 'in vitro').length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all">
                <div className="space-y-4">
                  {studies.length > 0 ? (
                    studies.map((study: any) => (
                      <StudyCard key={study.id} study={study} />
                    ))
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-muted-foreground">No studies found for this benefit.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="clinical">
                <div className="space-y-4">
                  {studies.filter((s: any) => s.studyType === 'human').length > 0 ? (
                    studies
                      .filter((s: any) => s.studyType === 'human')
                      .map((study: any) => (
                        <StudyCard key={study.id} study={study} />
                      ))
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-muted-foreground">No clinical studies found for this benefit.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="preclinical">
                <div className="space-y-4">
                  {studies.filter((s: any) => s.studyType === 'animal' || s.studyType === 'in vitro').length > 0 ? (
                    studies
                      .filter((s: any) => s.studyType === 'animal' || s.studyType === 'in vitro')
                      .map((study: any) => (
                        <StudyCard key={study.id} study={study} />
                      ))
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-muted-foreground">No preclinical studies found for this benefit.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}
    </div>
  );
};

// Study card component for displaying study info
const StudyCard: React.FC<{ study: any }> = ({ study }) => {
  return (
    <Link href={`/studies/${study.id}`}>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex justify-between">
            <CardTitle className="text-lg font-medium">{study.title}</CardTitle>
            {study.peerReviewed && (
              <Badge className="ml-2" variant="secondary">Peer Reviewed</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>{new Date(study.publishDate).getFullYear()}</span>
            <span>•</span>
            <span>{study.journal}</span>
            {study.studyType && (
              <>
                <span>•</span>
                <span className="capitalize">{study.studyType} Study</span>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm line-clamp-2">{study.abstract}</p>
          
          <div className="mt-4 flex justify-between items-center">
            <div className="flex space-x-2">
              {study.doi && (
                <Badge variant="outline">DOI: {study.doi}</Badge>
              )}
            </div>
            <Button variant="ghost" size="sm">
              View Study
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};