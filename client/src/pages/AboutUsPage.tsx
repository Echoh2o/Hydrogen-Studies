import React from 'react';
import { Link } from 'wouter';
import { Users, Target, Heart, Award, BookOpen, Microscope, Globe, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function AboutUsPage() {
  const teamMembers = [
    {
      name: 'Dr. Sarah Chen',
      role: 'Chief Medical Officer',
      expertise: 'Gastroenterology & Hydrogen Research',
      bio: 'Board-certified gastroenterologist with over 15 years of experience in integrative digestive health. Leading researcher in hydrogen therapy applications.',
      image: 'https://placehold.co/300x300/e2f3ff/003366?text=Dr.+Chen'
    },
    {
      name: 'Dr. James Wilson',
      role: 'Research Director',
      expertise: 'Molecular Biology & Oxidative Stress',
      bio: 'PhD in Molecular Biology with focus on antioxidant mechanisms. Published over 40 peer-reviewed articles on hydrogen therapy.',
      image: 'https://placehold.co/300x300/e2f3ff/003366?text=Dr.+Wilson'
    },
    {
      name: 'Dr. Maria Rodriguez',
      role: 'Clinical Research Lead',
      expertise: 'Cardiology & Sports Medicine',
      bio: 'Cardiologist specializing in performance medicine. Conducts clinical trials on hydrogen therapy for athletic performance and recovery.',
      image: 'https://placehold.co/300x300/e2f3ff/003366?text=Dr.+Rodriguez'
    }
  ];

  const milestones = [
    {
      year: '2019',
      title: 'Platform Launch',
      description: 'Launched HydrogenStudies.com with initial database of 200 peer-reviewed studies'
    },
    {
      year: '2021',
      title: 'Research Expansion',
      description: 'Expanded to include over 800 studies and launched AI-powered search capabilities'
    },
    {
      year: '2023',
      title: 'Global Recognition',
      description: 'Became the leading hydrogen research database, cited by researchers worldwide'
    },
    {
      year: '2024',
      title: 'Platform Redesign',
      description: 'Launched modern interface with 1,300+ studies and advanced educational content'
    }
  ];

  const values = [
    {
      icon: <BookOpen className="h-8 w-8 text-blue-600" />,
      title: 'Scientific Integrity',
      description: 'We only feature peer-reviewed research from reputable scientific journals, ensuring the highest standards of evidence-based information.'
    },
    {
      icon: <Heart className="h-8 w-8 text-red-600" />,
      title: 'Accessibility',
      description: 'Complex scientific research should be understandable to everyone. We make hydrogen science accessible without compromising accuracy.'
    },
    {
      icon: <Users className="h-8 w-8 text-green-600" />,
      title: 'Community Focus',
      description: 'We serve researchers, healthcare professionals, and individuals seeking evidence-based information about hydrogen therapy.'
    },
    {
      icon: <Globe className="h-8 w-8 text-purple-600" />,
      title: 'Global Impact',
      description: 'Our platform serves users worldwide, advancing the understanding and application of hydrogen therapy globally.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <Users className="h-16 w-16 text-blue-600 mx-auto mb-6" />
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            About
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {" "}HydrogenStudies
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Making hydrogen health research accessible to everyone through comprehensive, 
            evidence-based information and cutting-edge technology
          </p>
          <Badge className="bg-blue-100 text-blue-800 px-4 py-2">
            Trusted by researchers and health professionals worldwide
          </Badge>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Target className="h-12 w-12 text-blue-600 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Mission</h2>
          </div>
          
          <div className="bg-blue-50 p-8 rounded-lg border-l-4 border-blue-600">
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              To democratize access to hydrogen health research by creating the world's most comprehensive, 
              user-friendly database of peer-reviewed studies, empowering individuals, healthcare professionals, 
              and researchers to make informed decisions based on scientific evidence.
            </p>
            <p className="text-gray-600">
              We believe that breakthrough scientific research should be accessible to everyone, not locked away 
              in academic journals. Through our platform, we bridge the gap between complex research and 
              practical understanding, advancing the field of hydrogen therapy for global health benefit.
            </p>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Core Values</h2>
            <p className="text-lg text-gray-600">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((value, index) => (
              <Card key={index} className="border-l-4 border-l-blue-600">
                <CardHeader>
                  <div className="flex items-center space-x-3 mb-4">
                    {value.icon}
                    <CardTitle className="text-xl">{value.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Meet Our Expert Team</h2>
            <p className="text-lg text-gray-600">
              Leading researchers and medical professionals dedicated to advancing hydrogen science
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {teamMembers.map((member, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
                  />
                  <CardTitle className="text-xl">{member.name}</CardTitle>
                  <CardDescription className="text-blue-600 font-medium">{member.role}</CardDescription>
                  <Badge variant="outline" className="w-fit mx-auto mt-2">{member.expertise}</Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm leading-relaxed">{member.bio}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Our Journey */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Journey</h2>
            <p className="text-lg text-gray-600">
              Key milestones in building the world's leading hydrogen research platform
            </p>
          </div>

          <div className="space-y-8">
            {milestones.map((milestone, index) => (
              <div key={index} className="flex items-start space-x-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{milestone.year}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{milestone.title}</h3>
                  <p className="text-gray-600">{milestone.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partnership */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-blue-50">
        <div className="max-w-4xl mx-auto text-center">
          <Award className="h-16 w-16 text-blue-600 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Partnership with EchoWater</h2>
          <div className="bg-white p-8 rounded-lg">
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              HydrogenStudies.com is proudly powered by EchoWater, a leader in hydrogen water technology. 
              This partnership ensures our platform remains independent while providing users with access 
              to high-quality hydrogen products backed by the research we curate.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Research Independence</h3>
                <p className="text-sm text-gray-600">
                  Our research curation remains completely independent and unbiased, 
                  featuring studies from all sources regardless of product affiliation.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Quality Products</h3>
                <p className="text-sm text-gray-600">
                  EchoWater's commitment to quality ensures users have access to 
                  hydrogen products that meet the standards supported by research.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Platform Impact</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">1,326+</div>
              <div className="text-gray-600">Peer-Reviewed Studies</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-600 mb-2">50+</div>
              <div className="text-gray-600">Health Conditions</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-600 mb-2">25+</div>
              <div className="text-gray-600">Countries Served</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-600 mb-2">96%</div>
              <div className="text-gray-600">Studies with DOI Links</div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Join Our Mission</h2>
          <p className="text-lg text-gray-600 mb-8">
            Whether you're a researcher, healthcare professional, or someone interested in hydrogen therapy, 
            we invite you to explore our platform and contribute to advancing this important field.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/studies">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <Microscope className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <CardTitle className="text-center">Explore Research</CardTitle>
                  <CardDescription className="text-center">
                    Browse our comprehensive database of studies
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/contact">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <Users className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <CardTitle className="text-center">Contact Us</CardTitle>
                  <CardDescription className="text-center">
                    Get in touch with our expert team
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/chat">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <Heart className="h-8 w-8 text-red-600 mx-auto mb-2" />
                  <CardTitle className="text-center">Ask Questions</CardTitle>
                  <CardDescription className="text-center">
                    Get personalized answers from our AI assistant
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