import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Heart, Brain, Zap, Shield, Droplet, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import SiteHeader from '@/components/layout/SiteHeader';

export default function HealthBenefitsPage() {
  const healthCategories = [
    {
      category: 'Cardiovascular Health',
      icon: <Heart className="h-8 w-8 text-red-600" />,
      description: 'Heart health, circulation, and vascular function',
      studyCount: 85,
      evidenceLevel: 85,
      benefits: [
        'May reduce inflammation in blood vessels',
        'Could improve heart function markers',
        'Potential to lower oxidative stress',
        'May support healthy blood pressure'
      ],
      keyFindings: 'Studies suggest hydrogen therapy may help protect the cardiovascular system through its anti-inflammatory and antioxidant properties.',
      population: 'Adults with cardiovascular risk factors'
    },
    {
      category: 'Neurological Health',
      icon: <Brain className="h-8 w-8 text-purple-600" />,
      description: 'Brain function, cognitive health, and neuroprotection',
      studyCount: 120,
      evidenceLevel: 78,
      benefits: [
        'May protect brain cells from oxidative damage',
        'Could support cognitive function',
        'Potential neuroprotective effects',
        'May help with neuroinflammation'
      ],
      keyFindings: 'Research indicates hydrogen can cross the blood-brain barrier and may offer neuroprotective benefits.',
      population: 'Individuals concerned with brain health'
    },
    {
      category: 'Athletic Performance',
      icon: <Zap className="h-8 w-8 text-green-600" />,
      description: 'Exercise performance, recovery, and fatigue reduction',
      studyCount: 45,
      evidenceLevel: 82,
      benefits: [
        'May reduce exercise-induced fatigue',
        'Could improve recovery times',
        'Potential to reduce muscle soreness',
        'May enhance endurance capacity'
      ],
      keyFindings: 'Athletes using hydrogen water showed reduced fatigue and improved recovery in multiple studies.',
      population: 'Athletes and active individuals'
    },
    {
      category: 'Anti-Inflammatory',
      icon: <Shield className="h-8 w-8 text-orange-600" />,
      description: 'Inflammation reduction and immune system support',
      studyCount: 95,
      evidenceLevel: 88,
      benefits: [
        'May reduce inflammatory markers',
        'Could modulate immune responses',
        'Potential to decrease chronic inflammation',
        'May support tissue healing'
      ],
      keyFindings: 'Hydrogen therapy demonstrates consistent anti-inflammatory effects across various conditions.',
      population: 'Individuals with inflammatory conditions'
    },
    {
      category: 'Metabolic Health',
      icon: <TrendingUp className="h-8 w-8 text-blue-600" />,
      description: 'Metabolism, energy production, and cellular health',
      studyCount: 65,
      evidenceLevel: 75,
      benefits: [
        'May improve cellular energy production',
        'Could support healthy metabolism',
        'Potential to reduce oxidative stress',
        'May enhance mitochondrial function'
      ],
      keyFindings: 'Research suggests hydrogen may support metabolic processes at the cellular level.',
      population: 'Adults interested in metabolic health'
    },
    {
      category: 'Skin Health',
      icon: <Droplet className="h-8 w-8 text-cyan-600" />,
      description: 'Skin protection, healing, and aesthetic benefits',
      studyCount: 35,
      evidenceLevel: 70,
      benefits: [
        'May protect skin from UV damage',
        'Could improve skin hydration',
        'Potential anti-aging effects',
        'May support wound healing'
      ],
      keyFindings: 'Studies show hydrogen water and baths may benefit skin health through antioxidant effects.',
      population: 'Individuals focused on skin wellness'
    }
  ];

  const getEvidenceLevelColor = (level: number) => {
    if (level >= 80) return 'text-green-600';
    if (level >= 70) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getEvidenceLevelText = (level: number) => {
    if (level >= 80) return 'Strong';
    if (level >= 70) return 'Moderate';
    return 'Emerging';
  };

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/learn" className="flex items-center text-blue-600 hover:text-blue-700">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Learn
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <Heart className="h-16 w-16 text-red-600 mx-auto mb-6" />
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Health Benefits &
            <span className="bg-gradient-to-r from-red-600 to-purple-600 bg-clip-text text-transparent">
              {" "}Applications
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Discover how hydrogen therapy may support various aspects of health and wellness based on scientific research
          </p>
          <Badge className="bg-red-100 text-red-800 px-4 py-2">
            Based on 450+ health-focused studies
          </Badge>
        </div>
      </section>

      {/* Health Categories */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Health Applications</h2>
            <p className="text-lg text-gray-600">
              Explore the potential benefits of hydrogen therapy for different health areas
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {healthCategories.map((category, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow border-l-4 border-l-blue-600">
                <CardHeader>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {category.icon}
                      <div>
                        <CardTitle className="text-xl">{category.category}</CardTitle>
                        <CardDescription>{category.description}</CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="mb-1">{category.studyCount} studies</Badge>
                      <p className={`text-sm font-medium ${getEvidenceLevelColor(category.evidenceLevel)}`}>
                        {getEvidenceLevelText(category.evidenceLevel)} Evidence
                      </p>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Evidence Quality</span>
                      <span>{category.evidenceLevel}%</span>
                    </div>
                    <Progress value={category.evidenceLevel} className="h-2" />
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div>
                    <p className="font-medium text-gray-700 mb-2">Potential Benefits:</p>
                    <ul className="space-y-1">
                      {category.benefits.map((benefit, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start">
                          <div className="h-1.5 w-1.5 bg-blue-600 rounded-full mr-2 mt-2 flex-shrink-0"></div>
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium text-gray-700 mb-2">Key Research Finding:</p>
                    <p className="text-sm text-gray-600">{category.keyFindings}</p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center text-sm text-gray-500">
                      <Users className="h-4 w-4 mr-1" />
                      {category.population}
                    </div>
                    <Link href={`/studies?category=${encodeURIComponent(category.category)}`}>
                      <Badge variant="outline" className="hover:bg-blue-50 cursor-pointer">
                        View Studies
                      </Badge>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Important Notes */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-yellow-50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white p-8 rounded-lg border border-yellow-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Important Considerations</h3>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>Individual Results May Vary:</strong> The benefits described are based on research studies and may not apply to everyone. Individual responses can differ based on health status, dosage, and other factors.
              </p>
              <p>
                <strong>Not Medical Advice:</strong> This information is for educational purposes only and should not be considered medical advice. Always consult with qualified healthcare professionals before starting any new health regimen.
              </p>
              <p>
                <strong>Research is Ongoing:</strong> While promising, hydrogen therapy research is still evolving. Many studies are preliminary and more research is needed to fully understand all potential benefits and applications.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Next Steps */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Explore Further</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/learn/mechanisms">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <Shield className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <CardTitle className="text-center">Scientific Mechanisms</CardTitle>
                  <CardDescription className="text-center">
                    Learn how hydrogen works at the cellular level
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/studies">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <CardTitle className="text-center">Browse Research</CardTitle>
                  <CardDescription className="text-center">
                    Explore studies by health condition or benefit
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/chat">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <Brain className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <CardTitle className="text-center">Ask Questions</CardTitle>
                  <CardDescription className="text-center">
                    Get personalized information about hydrogen therapy
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}