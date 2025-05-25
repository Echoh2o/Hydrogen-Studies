import React from 'react';
import { Link } from 'wouter';
import { BookOpen, FlaskConical, Heart, Brain, Zap, ChevronRight, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function LearnPage() {
  const learningTopics = [
    {
      id: 'basics',
      title: 'Hydrogen Therapy Basics',
      description: 'Understanding the fundamentals of molecular hydrogen and its health applications',
      icon: <FlaskConical className="h-8 w-8 text-blue-600" />,
      topics: ['What is molecular hydrogen?', 'How does it work in the body?', 'Safety and dosage'],
      studyCount: 1326,
      difficulty: 'Beginner'
    },
    {
      id: 'health-benefits',
      title: 'Health Benefits & Applications',
      description: 'Explore the wide range of health conditions hydrogen therapy may support',
      icon: <Heart className="h-8 w-8 text-red-600" />,
      topics: ['Cardiovascular health', 'Anti-inflammatory effects', 'Neurological support'],
      studyCount: 850,
      difficulty: 'Intermediate'
    },
    {
      id: 'mechanisms',
      title: 'Scientific Mechanisms',
      description: 'Deep dive into how hydrogen works at the cellular and molecular level',
      icon: <Brain className="h-8 w-8 text-purple-600" />,
      topics: ['Antioxidant properties', 'Cellular signaling', 'Gene expression'],
      studyCount: 420,
      difficulty: 'Advanced'
    },
    {
      id: 'delivery-methods',
      title: 'Delivery Methods',
      description: 'Learn about different ways to consume hydrogen for health benefits',
      icon: <Zap className="h-8 w-8 text-green-600" />,
      topics: ['Hydrogen water', 'Inhalation therapy', 'Hydrogen baths'],
      studyCount: 380,
      difficulty: 'Beginner'
    }
  ];

  const quickFacts = [
    'Hydrogen is the smallest and lightest molecule in the universe',
    'It can easily penetrate cell membranes and reach mitochondria',
    'Over 1,300 peer-reviewed studies support its therapeutic potential',
    'Hydrogen therapy has been used safely in medical settings for decades',
    'It acts as a selective antioxidant, targeting only harmful free radicals'
  ];

  const researchHighlights = [
    {
      title: 'Cardiovascular Health',
      finding: 'Studies show hydrogen may reduce inflammation in blood vessels and improve heart function',
      studyCount: 85,
      category: 'Heart Health'
    },
    {
      title: 'Neurological Protection',
      finding: 'Research indicates hydrogen may protect brain cells from oxidative stress and inflammation',
      studyCount: 120,
      category: 'Brain Health'
    },
    {
      title: 'Athletic Performance',
      finding: 'Evidence suggests hydrogen water may reduce exercise fatigue and improve recovery',
      studyCount: 45,
      category: 'Sports Medicine'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <BookOpen className="h-16 w-16 text-blue-600 mx-auto mb-6" />
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Learn About
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {" "}Hydrogen Therapy
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Discover the science behind hydrogen therapy with evidence-based information 
            from over 1,300 peer-reviewed studies
          </p>
        </div>
      </section>

      {/* Quick Facts */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Quick Facts About Hydrogen</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickFacts.map((fact, index) => (
              <div key={index} className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                <p className="text-gray-700">{fact}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Learning Topics */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Learning Pathways</h2>
            <p className="text-lg text-gray-600">
              Choose your learning journey based on your background and interests
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {learningTopics.map((topic) => (
              <Link key={topic.id} href={`/learn/${topic.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-200 h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {topic.icon}
                        <div>
                          <Badge variant="outline" className="mb-2">{topic.difficulty}</Badge>
                          <CardTitle className="text-xl">{topic.title}</CardTitle>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="text-base">{topic.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="font-medium text-gray-700 mb-2">What you'll learn:</p>
                        <ul className="space-y-1">
                          {topic.topics.map((subtopic, index) => (
                            <li key={index} className="text-sm text-gray-600 flex items-center">
                              <CheckCircle className="h-3 w-3 text-green-600 mr-2" />
                              {subtopic}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t">
                        <span className="text-sm text-gray-500">{topic.studyCount} supporting studies</span>
                        <div className="flex items-center text-blue-600 font-medium">
                          Start learning <ChevronRight className="h-4 w-4 ml-1" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Research Highlights */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Key Research Findings</h2>
            <p className="text-lg text-gray-600">
              Discover what the latest research tells us about hydrogen therapy
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {researchHighlights.map((highlight, index) => (
              <Card key={index} className="border-l-4 border-l-blue-600">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary">{highlight.category}</Badge>
                    <span className="text-sm text-gray-500">{highlight.studyCount} studies</span>
                  </div>
                  <CardTitle className="text-lg">{highlight.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{highlight.finding}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/studies">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Explore All Research Studies
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Ready to Dive Deeper?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link href="/learn/basics">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FlaskConical className="h-5 w-5 text-blue-600 mr-2" />
                    Start with the Basics
                  </CardTitle>
                  <CardDescription>
                    Perfect for beginners wanting to understand hydrogen therapy fundamentals
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
            
            <Link href="/chat">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Brain className="h-5 w-5 text-purple-600 mr-2" />
                    Ask Our AI Assistant
                  </CardTitle>
                  <CardDescription>
                    Get personalized answers about hydrogen research and applications
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}