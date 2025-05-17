import React, { useState, useRef, useEffect } from 'react';
import { Send, RefreshCw, ThumbsUp, ThumbsDown, Clock, MessageSquare, X, FileText, Menu, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Types for the chat functionality
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  id?: number;
  timestamp?: Date;
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
  conversationId?: number;
}

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export const ChatWidget: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSources, setCurrentSources] = useState<ChatSource[]>([]);
  const [relatedQuestions, setRelatedQuestions] = useState<string[]>([]);
  const [popularQuestions, setPopularQuestions] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [lastMessageId, setLastMessageId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showConversations, setShowConversations] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load user's conversation history and popular questions on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load conversations (if authenticated)
        const conversationsResponse = await apiRequest<{ success: boolean; data: Conversation[] }>('/api/chat/conversations');
        if (conversationsResponse.success && conversationsResponse.data) {
          setConversations(conversationsResponse.data);
          console.log('Loaded user conversations:', conversationsResponse.data.length);
        }
        
        // Load popular questions for all users (regardless of authentication)
        const questionsResponse = await apiRequest<{ success: boolean; data: string[] }>('/api/chat/popular-questions?limit=5');
        if (questionsResponse.success && questionsResponse.data) {
          setPopularQuestions(questionsResponse.data);
          console.log('Loaded popular questions:', questionsResponse.data.length);
        }
      } catch (err) {
        // Error handling - non-critical, so we log but don't show error to user
        console.log('Error loading initial data:', err);
      }
    };
    
    loadInitialData();
  }, []);
  
  // Load conversation history when a conversation is selected
  const loadConversation = async (id: number) => {
    try {
      setIsLoading(true);
      const response = await apiRequest<{ success: boolean; data: ChatMessage[] }>(
        `/api/chat/conversation/${id}`
      );
      
      if (response.success && response.data) {
        setMessages(response.data);
        setConversationId(id);
        setShowConversations(false);
        console.log('Loaded conversation:', id, 'with', response.data.length, 'messages');
      }
    } catch (err: any) {
      setError('Failed to load conversation history');
      console.error('Error loading conversation:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Submit feedback for an assistant message
  const submitFeedback = async (messageId: number, rating: 'helpful' | 'unhelpful', comment?: string) => {
    try {
      const response = await apiRequest<{ success: boolean; message: string }>(
        '/api/chat/feedback',
        {
          method: 'POST',
          body: JSON.stringify({
            messageId,
            rating: rating === 'helpful' ? 5 : 1, // 5-star rating for helpful, 1-star for unhelpful
            comment
          })
        }
      );
      
      if (response.success) {
        setFeedbackSubmitted(true);
        console.log('Feedback submitted successfully');
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setError(null);
    setFeedbackSubmitted(false);
    
    // Add user message to chat
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    
    // Clear previous related questions when sending a new message
    setRelatedQuestions([]);
    
    setIsLoading(true);
    try {
      // Get only the last 6 messages to maintain context without exceeding token limits
      const recentMessages = newMessages.slice(-6);
      
      console.log('Sending chat request with conversation ID:', conversationId);
      
      const response = await apiRequest<{ success: boolean; data: ChatResponse }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          query: userMessage,
          conversationId: conversationId
        })
      });

      if (response.success && response.data) {
        // Update conversation ID if this is a new conversation
        if (response.data.conversationId && !conversationId) {
          setConversationId(response.data.conversationId);
          console.log('New conversation created with ID:', response.data.conversationId);
          
          // Add this new conversation to the list if it's not already there
          if (!conversations.some(c => c.id === response.data.conversationId)) {
            const newConversation: Conversation = {
              id: response.data.conversationId!,
              title: userMessage.substring(0, 30) + (userMessage.length > 30 ? '...' : ''),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            setConversations(prev => [newConversation, ...prev]);
          }
        }
        
        // Add assistant response to chat
        const assistantMessage: ChatMessage = { 
          role: 'assistant', 
          content: response.data.answer,
          id: Math.floor(Math.random() * 10000) // Temporary ID for testing feedback
        };
        
        setMessages([...newMessages, assistantMessage]);
        setLastMessageId(assistantMessage.id || null);
        
        // Update sources and related questions
        setCurrentSources(response.data.sources || []);
        setRelatedQuestions(response.data.relatedQuestions || []);
        
        console.log('Chat response received with sources:', response.data.sources?.length);
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
    setConversationId(null);
    setLastMessageId(null);
    setFeedbackSubmitted(false);
  };

  return (
    <div className="relative flex w-full max-w-5xl mx-auto">
      {/* Conversation History Sidebar */}
      <Sheet open={showConversations} onOpenChange={setShowConversations}>
        <SheetTrigger asChild>
          <Button 
            variant="outline" 
            size="icon"
            className="absolute left-2 top-2 z-10 md:hidden"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[300px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Conversation History</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-5rem)] mt-4">
            {conversations.length > 0 ? (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <Button
                    key={conv.id}
                    variant={conversationId === conv.id ? "default" : "outline"}
                    className="w-full justify-start text-left"
                    onClick={() => loadConversation(conv.id)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    <div className="truncate">
                      {conv.title}
                      <p className="text-xs text-muted-foreground">
                        {new Date(conv.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No saved conversations
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Main Conversation Area */}
      <div className="hidden md:block md:w-[250px] border-r mx-4">
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Conversations</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleReset}
              className="text-xs"
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              New
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            {conversations.length > 0 ? (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <Button
                    key={conv.id}
                    variant={conversationId === conv.id ? "default" : "ghost"}
                    className="w-full justify-start text-left h-auto py-2"
                    onClick={() => loadConversation(conv.id)}
                  >
                    <div className="truncate">
                      {conv.title}
                      <p className="text-xs text-muted-foreground">
                        {new Date(conv.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-4 text-sm">
                No saved conversations
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      <Card className="flex-1 shadow-lg border-muted min-h-[600px] flex flex-col">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-600 text-white">
          <CardTitle className="flex items-center justify-between">
            <span>Hydrogen Health & Wellness Assistant</span>
            <div className="flex items-center gap-2">
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
            </div>
          </CardTitle>
        </CardHeader>
      
        <CardContent className="p-4 min-h-[400px] max-h-[600px] overflow-y-auto flex-grow">
          {messages.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <h3 className="text-lg font-semibold mb-2">Welcome to the Hydrogen Health Research Assistant</h3>
              <p className="mb-6">Ask any question about hydrogen and health - including hydrogen-rich water, hydrogen gas inhalation, and hydrogen baths. I'll provide scientifically-backed answers from peer-reviewed studies on how hydrogen can improve your wellness.</p>
              
              <div className="grid grid-cols-1 gap-2 max-w-md mx-auto text-sm">
                {/* Show popular questions if available */}
                {popularQuestions.length > 0 ? (
                  <>
                    <div className="text-sm font-medium text-left mb-1 text-muted-foreground">Popular Questions:</div>
                    {popularQuestions.map((question, index) => (
                      <Button 
                        key={index}
                        variant="outline" 
                        className="justify-start" 
                        onClick={() => setInput(question)}
                      >
                        {question}
                      </Button>
                    ))}
                  </>
                ) : (
                  // Default questions if no popular questions available
                  <>
                    <Button 
                      variant="outline" 
                      className="justify-start" 
                      onClick={() => setInput("How does hydrogen water help with inflammation?")}
                    >
                      How does hydrogen water help with inflammation?
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-start" 
                      onClick={() => setInput("What benefits can I expect from inhaling molecular hydrogen gas?")}
                    >
                      What benefits can I expect from inhaling molecular hydrogen gas?
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-start" 
                      onClick={() => setInput("Is hydrogen-enriched bath water beneficial for skin conditions?")}
                    >
                      Is hydrogen-enriched bath water beneficial for skin conditions?
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={index} className="space-y-2">
                  <div 
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
                  
                  {/* Feedback buttons for assistant messages */}
                  {message.role === 'assistant' && message.id && !feedbackSubmitted && index === messages.length - 1 && (
                    <div className="flex justify-start pl-4 space-x-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-muted-foreground hover:text-primary h-7"
                              onClick={() => submitFeedback(message.id!, 'helpful')}
                            >
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              Helpful
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Mark this response as helpful</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-muted-foreground hover:text-destructive h-7"
                              onClick={() => submitFeedback(message.id!, 'unhelpful')}
                            >
                              <ThumbsDown className="h-3 w-3 mr-1" />
                              Not helpful
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Mark this response as not helpful</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                  
                  {/* Feedback submitted confirmation */}
                  {message.role === 'assistant' && message.id && feedbackSubmitted && index === messages.length - 1 && (
                    <div className="flex justify-start pl-4">
                      <span className="text-xs text-muted-foreground">
                        Thanks for your feedback!
                      </span>
                    </div>
                  )}
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
            
            {/* Product recommendation for health-related hydrogen queries */}
            {messages.length > 0 && 
             messages[messages.length - 1].role === 'assistant' && 
             (messages[messages.length - 1].content.toLowerCase().includes('water') || 
              messages[messages.length - 1].content.toLowerCase().includes('drink') ||
              messages[messages.length - 1].content.toLowerCase().includes('bath') ||
              messages[messages.length - 1].content.toLowerCase().includes('inhale') ||
              messages[messages.length - 1].content.toLowerCase().includes('device')) && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" /> 
                  Looking for hydrogen products?
                </h4>
                <p className="text-xs mt-1 mb-2 text-muted-foreground">
                  Visit <a href="https://echowater.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 font-medium">Echo Water</a> for hydrogen-rich water systems and wellness products.
                </p>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="w-full text-xs"
                  onClick={() => window.open('https://echowater.com', '_blank')}
                >
                  View Products
                </Button>
              </div>
            )}
          </div>
        )}
        
        <CardFooter className="p-4 border-t mt-auto">
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
    </div>
  );
};

export default ChatWidget;