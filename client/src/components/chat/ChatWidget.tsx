import React, { useState, useRef, useEffect } from 'react';
import { Send, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';

// Types for the chat functionality
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSource {
  title: string;
  doi: string;
  authors: string;
  publishDate: string;
}

interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  relatedQuestions: string[];
}

export const ChatWidget: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSources, setCurrentSources] = useState<ChatSource[]>([]);
  const [relatedQuestions, setRelatedQuestions] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setError(null);
    
    // Add user message to chat
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    
    // Clear previous related questions when sending a new message
    setRelatedQuestions([]);
    
    setIsLoading(true);
    try {
      // Get only the last 6 messages to maintain context without exceeding token limits
      const recentMessages = newMessages.slice(-6);
      
      const response = await apiRequest<{ success: boolean; data: ChatResponse }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          query: userMessage,
          conversationHistory: recentMessages
        })
      });

      if (response.success && response.data) {
        // Add assistant response to chat
        setMessages([...newMessages, { 
          role: 'assistant', 
          content: response.data.answer 
        }]);
        
        // Update sources and related questions
        setCurrentSources(response.data.sources || []);
        setRelatedQuestions(response.data.relatedQuestions || []);
      } else {
        setError('Failed to get a response. Please try again.');
      }
    } catch (err) {
      console.error('Error in chat request:', err);
      setError('An error occurred while communicating with the AI. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRelatedQuestionClick = (question: string) => {
    setInput(question);
  };

  const handleReset = () => {
    setMessages([]);
    setCurrentSources([]);
    setRelatedQuestions([]);
    setError(null);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-lg border-muted">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-600 text-white">
        <CardTitle className="flex items-center justify-between">
          <span>Hydrogen Research AI Assistant</span>
          {messages.length > 0 && (
            <Button 
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-white hover:text-white hover:bg-white/20"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-4 min-h-[400px] max-h-[600px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <h3 className="text-lg font-semibold mb-2">Welcome to the Hydrogen Research Assistant</h3>
            <p className="mb-6">Ask any question about hydrogen research, and I'll provide scientifically-backed answers from peer-reviewed studies.</p>
            <div className="grid grid-cols-1 gap-2 max-w-md mx-auto text-sm">
              <Button 
                variant="outline" 
                className="justify-start" 
                onClick={() => setInput("What are the latest developments in hydrogen fuel cell technology?")}
              >
                What are the latest developments in hydrogen fuel cell technology?
              </Button>
              <Button 
                variant="outline" 
                className="justify-start" 
                onClick={() => setInput("How does molecular hydrogen affect inflammation in the body?")}
              >
                How does molecular hydrogen affect inflammation in the body?
              </Button>
              <Button 
                variant="outline" 
                className="justify-start" 
                onClick={() => setInput("What are the challenges in hydrogen storage for transportation?")}
              >
                What are the challenges in hydrogen storage for transportation?
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`rounded-lg px-4 py-2 max-w-[80%] ${
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg px-4 py-2 max-w-[80%] bg-muted">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </CardContent>
      
      {currentSources.length > 0 && (
        <>
          <Separator />
          <div className="p-4 bg-muted/50">
            <h4 className="text-sm font-medium mb-2">Sources:</h4>
            <div className="space-y-2">
              {currentSources.map((source, index) => (
                <div key={index} className="text-xs">
                  <div className="font-medium">{source.title}</div>
                  <div className="text-muted-foreground">
                    {source.authors} ({new Date(source.publishDate).getFullYear()})
                    {source.doi && source.doi !== "No DOI available" && (
                      <> • DOI: <a 
                        href={`https://doi.org/${source.doi}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {source.doi}
                      </a></>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      
      {relatedQuestions.length > 0 && (
        <div className="px-4 py-3 bg-muted/30">
          <h4 className="text-sm font-medium mb-2">Related Questions:</h4>
          <div className="flex flex-wrap gap-2">
            {relatedQuestions.map((question, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="cursor-pointer hover:bg-muted"
                onClick={() => handleRelatedQuestionClick(question)}
              >
                {question}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      <CardFooter className="p-4 border-t">
        <form onSubmit={handleSubmit} className="w-full flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about hydrogen research..."
            className="min-h-[60px] flex-grow"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};

export default ChatWidget;