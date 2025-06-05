import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, Users, BookOpen, Sparkles, Heart, Brain, Shield } from "lucide-react";
import { Link } from "wouter";

interface Study {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string;
  category: string;
  healthCondition?: string;
  intervention?: string;
  population?: string;
  imageUrl?: string;
  simplifiedExplanation?: string;
  tags?: string[];
  healthBenefits?: string[];
  healthConditions?: string[];
  bodySystems?: string[];
  lifeStages?: string[];
  studyTypes?: string[];
  mechanisms?: string[];
  enhancedWithAI?: boolean;
  readingLevel?: string;
  estimatedReadTime?: number;
  popularityScore?: number;
  seoTitle?: string;
  seoDescription?: string;
}

interface EnhancedStudyCardProps {
  study: Study;
  variant?: 'default' | 'compact' | 'featured';
}

export function EnhancedStudyCard({ study, variant = 'default' }: EnhancedStudyCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getReadingLevelColor = (level?: string) => {
    const colors: Record<string, string> = {
      'beginner': 'bg-green-100 text-green-800',
      'intermediate': 'bg-blue-100 text-blue-800',
      'advanced': 'bg-orange-100 text-orange-800',
      'expert': 'bg-red-100 text-red-800'
    };
    return colors[level || ''] || 'bg-gray-100 text-gray-800';
  };

  const getHealthBenefitIcon = (benefit: string) => {
    if (benefit.toLowerCase().includes('heart') || benefit.toLowerCase().includes('cardio')) {
      return <Heart className="h-3 w-3" />;
    }
    if (benefit.toLowerCase().includes('brain') || benefit.toLowerCase().includes('neuro')) {
      return <Brain className="h-3 w-3" />;
    }
    return <Shield className="h-3 w-3" />;
  };

  if (variant === 'compact') {
    return (
      <Card className="hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {study.imageUrl && (
              <img
                src={study.imageUrl}
                alt={study.title}
                className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-gray-900 mb-1 line-clamp-2">
                <Link href={`/study/${study.id}`} className="hover:text-blue-600">
                  {study.title}
                </Link>
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <span>{formatDate(study.publishDate)}</span>
                {study.enhancedWithAI && (
                  <Badge variant="secondary" className="text-xs px-1 py-0">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Enhanced
                  </Badge>
                )}
              </div>
              {study.healthBenefits && study.healthBenefits.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {study.healthBenefits.slice(0, 2).map((benefit) => (
                    <Badge key={benefit} variant="outline" className="text-xs">
                      {getHealthBenefitIcon(benefit)}
                      <span className="ml-1">{benefit}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'featured') {
    return (
      <Card className="hover:shadow-xl transition-all duration-300 border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {study.enhancedWithAI && (
                  <Badge className="bg-purple-100 text-purple-800">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Enhanced Study
                  </Badge>
                )}
                {study.readingLevel && (
                  <Badge className={getReadingLevelColor(study.readingLevel)}>
                    {study.readingLevel} level
                  </Badge>
                )}
              </div>
              
              <CardTitle className="text-xl font-bold text-gray-900 leading-tight mb-3">
                <Link href={`/study/${study.slug || study.id}`} className="hover:text-blue-600 transition-colors">
                  {study.seoTitle || study.title}
                </Link>
              </CardTitle>
              
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(study.publishDate)}
                </div>
                <div className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  {study.journal}
                </div>
                {study.estimatedReadTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {study.estimatedReadTime}min read
                  </div>
                )}
              </div>
            </div>
            
            {study.imageUrl && (
              <div className="relative">
                <img
                  src={study.imageUrl}
                  alt={study.title}
                  className="w-32 h-32 object-cover rounded-lg shadow-md"
                />
                {study.enhancedWithAI && (
                  <div className="absolute -top-2 -right-2 bg-purple-500 text-white rounded-full p-1">
                    <Sparkles className="h-3 w-3" />
                  </div>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Simplified Explanation */}
          {study.simplifiedExplanation && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-200">
              <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Plain Language Summary
              </h4>
              <p className="text-sm text-blue-800 leading-relaxed">
                {study.simplifiedExplanation}
              </p>
            </div>
          )}

          {/* Health Benefits */}
          {study.healthBenefits && study.healthBenefits.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Health Benefits</h4>
              <div className="flex flex-wrap gap-2">
                {study.healthBenefits.map((benefit) => (
                  <Badge key={benefit} className="bg-green-100 text-green-800 flex items-center gap-1">
                    {getHealthBenefitIcon(benefit)}
                    {benefit}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Health Conditions & Body Systems */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {study.healthConditions && study.healthConditions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Health Conditions</h4>
                <div className="flex flex-wrap gap-1">
                  {study.healthConditions.map((condition) => (
                    <Badge key={condition} variant="secondary" className="bg-amber-100 text-amber-800">
                      {condition}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {study.bodySystems && study.bodySystems.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Body Systems</h4>
                <div className="flex flex-wrap gap-1">
                  {study.bodySystems.map((system) => (
                    <Badge key={system} variant="outline" className="border-purple-200 text-purple-700">
                      {system}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Study Details */}
          <div className="text-xs text-gray-600 mb-4 space-y-1">
            <div><strong>Authors:</strong> {study.authors}</div>
            {study.population && <div><strong>Population:</strong> {study.population}</div>}
            {study.intervention && <div><strong>Intervention:</strong> {study.intervention}</div>}
          </div>

          {/* Action Button */}
          <div className="flex justify-between items-center">
            <Link href={`/study/${study.id}`}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Read Full Study
              </Button>
            </Link>
            
            <div className="text-xs text-gray-500">
              Category: {study.category}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default variant
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {study.enhancedWithAI && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                  <Sparkles className="h-4 w-4 mr-1" />
                  AI Enhanced
                </Badge>
              )}
              {study.readingLevel && (
                <Badge className={getReadingLevelColor(study.readingLevel)}>
                  {study.readingLevel}
                </Badge>
              )}
            </div>
            
            <CardTitle className="text-lg font-semibold text-gray-900 leading-tight mb-2">
              <Link href={`/study/${study.slug || study.id}`} className="hover:text-blue-600 transition-colors">
                {study.title}
              </Link>
            </CardTitle>
            
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(study.publishDate)}
              </div>
              <div className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {study.journal}
              </div>
              {study.estimatedReadTime && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {study.estimatedReadTime}min
                </div>
              )}
            </div>
          </div>
          
          {study.imageUrl && (
            <img
              src={study.imageUrl}
              alt={study.title}
              className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
            />
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Simplified Explanation */}
        {study.simplifiedExplanation && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-200">
            <h4 className="text-sm font-semibold text-blue-900 mb-1">Plain Language Summary</h4>
            <p className="text-sm text-blue-800 leading-relaxed">
              {study.simplifiedExplanation.length > 200 
                ? `${study.simplifiedExplanation.substring(0, 200)}...`
                : study.simplifiedExplanation
              }
            </p>
          </div>
        )}

        {/* Abstract */}
        <p className="text-gray-700 text-sm leading-relaxed mb-4">
          {study.abstract.length > 300 
            ? `${study.abstract.substring(0, 300)}...`
            : study.abstract
          }
        </p>

        {/* Tags */}
        {(study.healthBenefits?.length || study.healthConditions?.length) && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {study.healthBenefits?.slice(0, 3).map((benefit) => (
                <Badge key={benefit} className="bg-green-100 text-green-800 flex items-center gap-1">
                  {getHealthBenefitIcon(benefit)}
                  {benefit}
                </Badge>
              ))}
              {study.healthConditions?.slice(0, 2).map((condition) => (
                <Badge key={condition} variant="secondary" className="bg-amber-100 text-amber-800">
                  {condition}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center">
          <Link href={`/study/${study.id}`}>
            <Button variant="default" size="sm">
              View Study
            </Button>
          </Link>
          
          <div className="text-xs text-gray-500">
            {study.category}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}