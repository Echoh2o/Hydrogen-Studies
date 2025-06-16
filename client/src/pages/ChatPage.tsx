import React from 'react';
import ChatWidget from '@/components/chat/ChatWidget';
import { Helmet } from 'react-helmet';
import SiteHeader from '@/components/layout/SiteHeader';

export const ChatPage: React.FC = () => {
  return (
    <>
      <SiteHeader />
      <div className="container mx-auto py-8 px-4">
      <Helmet>
        <title>Hydrogen Health & Wellness Assistant | HydrogenStudies.com</title>
        <meta name="description" content="Ask questions about hydrogen-rich water, hydrogen inhalation therapy, and hydrogen baths for health and wellness. Get evidence-based answers from peer-reviewed studies." />
        <meta property="og:title" content="Hydrogen Health & Wellness Assistant" />
        <meta property="og:description" content="Get answers about hydrogen water, inhalation therapy, and baths for your health and wellness, backed by scientific research." />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">
            Hydrogen Health & Wellness Assistant
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Get answers to your hydrogen health questions about hydrogen-rich water, inhalation therapy, and hydrogen baths. 
            All responses are sourced from peer-reviewed studies with proper citations.
          </p>
        </div>
        
        <ChatWidget />
        
        <div className="mt-10 bg-muted/30 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">About This Health & Wellness Assistant</h2>
          <div className="space-y-4 text-sm">
            <p>
              This hydrogen health assistant uses a specialized knowledge base to provide answers 
              backed by peer-reviewed scientific studies on hydrogen's health and wellness applications.
            </p>
            <p>
              Unlike general health chatbots, our assistant focuses exclusively on the therapeutic benefits 
              of hydrogen-rich water, hydrogen inhalation therapy, and hydrogen baths - with proper citations to scientific studies.
            </p>
            <p>
              This makes it an ideal resource for health-conscious individuals, wellness practitioners, and medical professionals
              looking for evidence-based information about hydrogen's potential benefits for various health conditions.
            </p>
            <p>
              <a href="https://echowater.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 font-medium">
                Visit Echo Water
              </a> to explore hydrogen-rich water systems and wellness products that can help you experience these benefits.
            </p>
            <div className="pt-4 border-t border-border">
              <h3 className="font-medium mb-2">Best practices for getting accurate health information:</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Be specific about your health interests or concerns</li>
                <li>Ask about specific hydrogen administration methods (water, inhalation, baths)</li>
                <li>Inquire about particular health conditions you're interested in</li>
                <li>Check the scientific studies cited to verify information</li>
                <li>Use the suggested related questions to explore health topics further</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;