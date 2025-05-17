import React from 'react';
import ChatWidget from '@/components/chat/ChatWidget';
import { Helmet } from 'react-helmet';

export const ChatPage: React.FC = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <Helmet>
        <title>AI Research Assistant | Hydrogen Studies</title>
        <meta name="description" content="Ask questions about hydrogen research and get scientifically-backed answers from our AI assistant, powered by a database of peer-reviewed studies." />
      </Helmet>

      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">
            Hydrogen Research AI Assistant
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Get answers to your hydrogen research questions, powered by our database of peer-reviewed studies. 
            All responses are sourced from scientific literature with proper citations.
          </p>
        </div>
        
        <ChatWidget />
        
        <div className="mt-10 bg-muted/30 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">About This AI Assistant</h2>
          <div className="space-y-4 text-sm">
            <p>
              This AI research assistant uses a Retrieval-Augmented Generation (RAG) approach to ensure that all answers 
              are backed by peer-reviewed hydrogen research studies in our database.
            </p>
            <p>
              Unlike general AI chatbots that may hallucinate or provide unreliable information, our assistant only provides 
              information that is directly supported by scientific studies in our collection, with proper citations.
            </p>
            <p>
              This makes it an ideal tool for researchers, students, and industry professionals who need reliable, 
              evidence-based answers to their hydrogen research questions.
            </p>
            <div className="pt-4 border-t border-border">
              <h3 className="font-medium mb-2">Best practices for getting accurate answers:</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Be specific in your questions</li>
                <li>Ask about one topic at a time</li>
                <li>If an answer seems incomplete, try rephrasing your question</li>
                <li>Check the sources provided to verify information</li>
                <li>Use the suggested related questions to explore a topic further</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;