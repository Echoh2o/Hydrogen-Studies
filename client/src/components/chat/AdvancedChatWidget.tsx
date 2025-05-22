import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, BookOpen, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    studiesReferenced?: number[];
    searchTerms?: string[];
    intent?: string;
    confidence?: number;
  };
}

interface ChatResponse {
  message: ChatMessage;
  relatedStudies: any[];
  suggestedQuestions: string[];
  productRecommendations: any[];
  conversationId: string;
}

interface AdvancedChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdvancedChatWidget({ isOpen, onClose }: AdvancedChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const [relatedStudies, setRelatedStudies] = useState<any[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [productRecommendations, setProductRecommendations] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/advanced-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage.content,
          conversationId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: { success: boolean; data: ChatResponse } = await response.json();

      if (data.success) {
        setMessages(prev => [...prev, data.data.message]);
        setConversationId(data.data.conversationId);
        setRelatedStudies(data.data.relatedStudies);
        setSuggestedQuestions(data.data.suggestedQuestions);
        setProductRecommendations(data.data.productRecommendations);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again or rephrase your question.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">Hydrogen Research Assistant</h3>
              <p className="text-sm text-muted-foreground">AI-powered research insights</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h4 className="text-lg font-medium mb-2">Welcome to Hydrogen Research Chat</h4>
                  <p className="text-muted-foreground mb-4">
                    Ask me anything about hydrogen health research, studies, or applications.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-md mx-auto">
                    {[
                      "What are the benefits of hydrogen water?",
                      "How does hydrogen therapy work?",
                      "Studies on hydrogen and inflammation",
                      "Hydrogen for athletic performance"
                    ].map((question, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuggestedQuestion(question)}
                        className="text-left h-auto p-2 text-sm"
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-4 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`flex gap-3 max-w-[80%] ${
                      message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.role === 'user'
                          ? 'bg-blue-500'
                          : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Bot className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div
                      className={`rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      {message.metadata && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {message.metadata.confidence && (
                            <Badge variant="secondary" className="text-xs">
                              Confidence: {Math.round(message.metadata.confidence * 100)}%
                            </Badge>
                          )}
                          {message.metadata.studiesReferenced && message.metadata.studiesReferenced.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {message.metadata.studiesReferenced.length} studies referenced
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="mb-4 flex justify-start">
                  <div className="flex gap-3 max-w-[80%]">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </div>
                        <span className="text-sm text-muted-foreground">Researching...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Suggested Questions */}
            {suggestedQuestions.length > 0 && (
              <div className="border-t p-4">
                <p className="text-sm text-muted-foreground mb-2">Suggested questions:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestedQuestion(question)}
                      className="text-left h-auto p-2 text-sm"
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about hydrogen research..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar for Related Content */}
          {(relatedStudies.length > 0 || productRecommendations.length > 0) && (
            <div className="w-80 border-l bg-muted/20 p-4 overflow-y-auto">
              {/* Related Studies */}
              {relatedStudies.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4" />
                    <h4 className="font-medium">Related Studies</h4>
                  </div>
                  <div className="space-y-2">
                    {relatedStudies.slice(0, 3).map((study) => (
                      <Card key={study.id} className="p-3">
                        <h5 className="font-medium text-sm mb-1">{study.title}</h5>
                        <p className="text-xs text-muted-foreground mb-2">
                          {study.authors} • {study.publishDate}
                        </p>
                        <p className="text-xs line-clamp-3">
                          {study.abstract?.substring(0, 120)}...
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Product Recommendations */}
              {productRecommendations.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="w-4 h-4" />
                    <h4 className="font-medium">Recommended Products</h4>
                  </div>
                  <div className="space-y-2">
                    {productRecommendations.map((product, index) => (
                      <Card key={index} className="p-3">
                        <h5 className="font-medium text-sm mb-1">{product.name}</h5>
                        <p className="text-xs text-muted-foreground mb-2">
                          {product.description}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs"
                          onClick={() => window.open(product.url, '_blank')}
                        >
                          Learn More
                        </Button>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}