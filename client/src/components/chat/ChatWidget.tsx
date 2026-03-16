import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Clock,
  MessageSquare,
  X,
  FileText,
  Menu,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Types for the chat functionality
interface ChatMessage {
  role: "user" | "assistant";
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

interface ProductRecommendation {
  name: string;
  description: string;
  url: string;
  imageUrl: string;
  relevanceScore?: number;
}

interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  relatedQuestions: string[];
  conversationId?: number;
  productRecommendations?: ProductRecommendation[];
}

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export const ChatWidget: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSources, setCurrentSources] = useState<ChatSource[]>([]);
  const [relatedQuestions, setRelatedQuestions] = useState<string[]>([]);
  const [popularQuestions, setPopularQuestions] = useState<string[]>([]);
  const [productRecommendations, setProductRecommendations] = useState<
    ProductRecommendation[]
  >([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [lastMessageId, setLastMessageId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showConversations, setShowConversations] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Load user's conversation history and popular questions on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load conversations (if authenticated)
        try {
          const conversationsResponse = await fetch("/api/chat/conversations", {
            credentials: "include",
          });
          if (conversationsResponse.ok) {
            const data = await conversationsResponse.json();
            if (data.data && Array.isArray(data.data)) {
              setConversations(data.data);
            }
          }
        } catch (convErr) {
          // Non-critical, continue to load popular questions
        }

        // Load popular questions for all users (regardless of authentication)
        try {
          const questionsResponse = await fetch(
            "/api/chat/popular-questions?limit=5",
            {
              credentials: "include",
            },
          );
          if (questionsResponse.ok) {
            const data = await questionsResponse.json();
            if (data.data && Array.isArray(data.data)) {
              setPopularQuestions(data.data);
            } else {
              // Set default popular questions as fallback
              setPopularQuestions([
                "What are the benefits of hydrogen water?",
                "How does molecular hydrogen help with inflammation?",
                "Can hydrogen therapy help with diabetes?",
                "What does research say about hydrogen for athletes?",
                "Is hydrogen water safe for daily consumption?",
              ]);
            }
          }
        } catch (questionsErr) {
          // Set default popular questions as fallback
          setPopularQuestions([
            "What are the benefits of hydrogen water?",
            "How does molecular hydrogen help with inflammation?",
            "Can hydrogen therapy help with diabetes?",
            "What does research say about hydrogen for athletes?",
            "Is hydrogen water safe for daily consumption?",
          ]);
        }
      } catch (err) {
        // Error handling - non-critical, so we don't show error to user
      }
    };

    loadInitialData();
  }, []);

  // Load conversation history when a conversation is selected
  const loadConversation = async (id: number) => {
    try {
      setIsLoading(true);
      const res = await apiRequest("GET", `/api/chat/conversation/${id}`);
      const response: { success: boolean; data: ChatMessage[] } = await res.json();

      if (response.success && response.data) {
        setMessages(response.data);
        setConversationId(id);
        setShowConversations(false);
      }
    } catch (err: any) {
      setError("Failed to load conversation history");
      console.error("Error loading conversation:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit feedback for an assistant message
  const submitFeedback = async (
    messageId: number,
    rating: "helpful" | "unhelpful",
    comment?: string,
  ) => {
    try {
      const res = await apiRequest("POST", "/api/chat/feedback", {
        messageId,
        rating: rating === "helpful" ? 5 : 1, // 5-star rating for helpful, 1-star for unhelpful
        comment,
      });
      const response: { success: boolean; message: string } = await res.json();

      if (response.success) {
        setFeedbackSubmitted(true);
      }
    } catch (err) {
      console.error("Error submitting feedback:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput("");
    setError(null);
    setFeedbackSubmitted(false);

    // Add user message to chat
    const newMessages: ChatMessage[] = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);

    // Clear previous related questions when sending a new message
    setRelatedQuestions([]);

    setIsLoading(true);
    try {
      // Get only the last 6 messages to maintain context without exceeding token limits
      const recentMessages = newMessages.slice(-6);

      // Use the API with a longer timeout for complex queries
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: userMessage,
            conversationId: conversationId,
          }),
          credentials: "include", // Include cookies for CSRF token
          signal: controller.signal,
        });

        // Clear the timeout
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        // Handle both possible response formats from the backend
        const responseData =
          data.success && data.data
            ? data.data.data
              ? data.data.data
              : data.data
            : null;

        if (responseData && responseData.answer) {
          // Update conversation ID if this is a new conversation
          if (responseData.conversationId && !conversationId) {
            setConversationId(responseData.conversationId);

            // Add this new conversation to the list if it's not already there
            if (
              !conversations.some((c) => c.id === responseData.conversationId)
            ) {
              const newConversation: Conversation = {
                id: responseData.conversationId!,
                title:
                  userMessage.substring(0, 30) +
                  (userMessage.length > 30 ? "..." : ""),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              setConversations((prev) => [newConversation, ...prev]);
            }
          }

          // Add assistant response to chat
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: responseData.answer,
            id: Math.floor(Math.random() * 10000), // Temporary ID for testing feedback
          };

          setMessages([...newMessages, assistantMessage]);
          setLastMessageId(assistantMessage.id || null);

          // Update sources, related questions, and product recommendations
          setCurrentSources(responseData.sources || []);
          setRelatedQuestions(responseData.relatedQuestions || []);
          setProductRecommendations(responseData.productRecommendations || []);
        } else {
          throw new Error("Invalid response format from server");
        }
      } catch (fetchError: any) {
        // Handle timeout specifically
        if (fetchError.name === "AbortError") {
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: `I'm taking a bit longer than usual to research your question about "${userMessage}". This usually means I'm finding comprehensive information from multiple studies. Please try asking your question again, and I'll work to respond more quickly.`,
            id: Math.floor(Math.random() * 10000),
          };
          setMessages([...newMessages, assistantMessage]);
        } else {
          // Generate fallback product recommendations based on the query
          generateFallbackProductRecommendations(userMessage);

          // Create a graceful fallback response for the user
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: `I'm sorry, but I'm having temporary difficulty accessing the research database. Your question about ${identifyQueryTopic(userMessage)} is important, and while I work to resolve this issue, I've included some product recommendations that might be helpful for your specific needs.`,
            id: Math.floor(Math.random() * 10000),
          };

          setMessages([...newMessages, assistantMessage]);
          setLastMessageId(assistantMessage.id || null);

          // Set related questions for continued engagement
          setRelatedQuestions([
            "What are the benefits of hydrogen water for inflammation?",
            "How does molecular hydrogen help with oxidative stress?",
            "What conditions can hydrogen therapy help with?",
            "How often should I use hydrogen therapy for best results?",
          ]);
        }

        console.error("Error fetching chat response:", fetchError);
      }
    } catch (err) {
      console.error("Error in chat request:", err);
      setError(
        "An error occurred while communicating with the AI. Please try again later.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to identify the topic of a query
  const identifyQueryTopic = (query: string): string => {
    const lowerQuery = query.toLowerCase();

    if (
      lowerQuery.includes("skin") ||
      lowerQuery.includes("derma") ||
      lowerQuery.includes("psoriasis") ||
      lowerQuery.includes("eczema") ||
      lowerQuery.includes("acne")
    ) {
      return "skin health and topical applications";
    } else if (
      lowerQuery.includes("breath") ||
      lowerQuery.includes("lung") ||
      lowerQuery.includes("inhal") ||
      lowerQuery.includes("respiratory")
    ) {
      return "respiratory health and breathing applications";
    } else if (
      lowerQuery.includes("athletic") ||
      lowerQuery.includes("workout") ||
      lowerQuery.includes("exercise") ||
      lowerQuery.includes("recovery")
    ) {
      return "athletic performance and recovery";
    } else if (
      lowerQuery.includes("travel") ||
      lowerQuery.includes("portable")
    ) {
      return "portable hydrogen therapy options";
    } else {
      return "hydrogen health applications";
    }
  };

  // Helper function to generate fallback product recommendations
  const generateFallbackProductRecommendations = (query: string) => {
    const lowerQuery = query.toLowerCase();

    // Always include the Echo Flask as a primary recommendation for every query
    const echoFlask = {
      name: "Echo H2 Flask",
      description:
        "Portable hydrogen-infusing water bottle for on-the-go hydrogen therapy with premium quality materials",
      url: "https://echowater.com/products/echo-h2-flask",
      imageUrl: "https://echowater.com/cdn/shop/products/echo-h2-flask.jpg",
      relevanceScore: 98,
    };

    if (
      lowerQuery.includes("skin") ||
      lowerQuery.includes("derma") ||
      lowerQuery.includes("psoriasis") ||
      lowerQuery.includes("eczema") ||
      lowerQuery.includes("acne")
    ) {
      // Recommend bath system for skin conditions and Flask for drinking water benefits
      setProductRecommendations([
        echoFlask,
        {
          name: "Echo H2 Bath System",
          description:
            "Advanced hydrogen bath system for full-body hydrogen therapy and skin health",
          url: "https://echowater.com/products/echo-h2-bath",
          imageUrl: "https://echowater.com/cdn/shop/products/echo-h2-bath.jpg",
          relevanceScore: 95,
        },
      ]);
    } else if (
      lowerQuery.includes("breath") ||
      lowerQuery.includes("lung") ||
      lowerQuery.includes("inhal") ||
      lowerQuery.includes("respiratory")
    ) {
      // Recommend inhaler for respiratory conditions and Flask for drinking water benefits
      setProductRecommendations([
        echoFlask,
        {
          name: "Echo H2 Inhaler",
          description:
            "Premium molecular hydrogen inhalation device for respiratory and systemic benefits",
          url: "https://echowater.com/products/echo-h2-inhaler",
          imageUrl:
            "https://echowater.com/cdn/shop/products/echo-h2-inhaler.jpg",
          relevanceScore: 95,
        },
      ]);
    } else if (
      lowerQuery.includes("athletic") ||
      lowerQuery.includes("workout") ||
      lowerQuery.includes("exercise") ||
      lowerQuery.includes("recovery") ||
      lowerQuery.includes("sport")
    ) {
      // Recommend Flask and tablets for athletic performance
      setProductRecommendations([
        echoFlask,
        {
          name: "Echo H2 Tablet Maker",
          description:
            "Portable hydrogen tablets for creating hydrogen-rich water during training sessions and competitions",
          url: "https://echowater.com/products/echo-h2-tablets-1",
          imageUrl:
            "https://echowater.com/cdn/shop/products/echo-h2-tablets.jpg",
          relevanceScore: 90,
        },
      ]);
    } else if (
      lowerQuery.includes("travel") ||
      lowerQuery.includes("portable") ||
      lowerQuery.includes("on the go") ||
      lowerQuery.includes("convenient")
    ) {
      // Flask is perfect for travel and portable use
      setProductRecommendations([
        {
          name: "Echo H2 Flask",
          description:
            "The ultimate portable hydrogen water solution for travel and on-the-go hydrogen therapy",
          url: "https://echowater.com/products/echo-h2-flask",
          imageUrl: "https://echowater.com/cdn/shop/products/echo-h2-flask.jpg",
          relevanceScore: 100,
        },
      ]);
    } else {
      // Default to Flask and water machine for general queries
      setProductRecommendations([
        echoFlask,
        {
          name: "Echo H2 Machine",
          description:
            "Premium hydrogen water generator for home use - great companion to your Echo Flask for maximum benefits",
          url: "https://echowater.com/products/echo-h2-machine",
          imageUrl:
            "https://echowater.com/cdn/shop/files/echo-h2-server-compressed-2_1024x1024.jpg",
          relevanceScore: 85,
        },
      ]);
    }
  };

  const handleRelatedQuestionClick = (question: string) => {
    setInput(question);
  };

  const handleReset = () => {
    setMessages([]);
    setCurrentSources([]);
    setRelatedQuestions([]);
    setProductRecommendations([]);
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
        <CardHeader className="bg-gradient-to-r from-teal-600 to-teal-600 text-white">
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
              <h3 className="text-lg font-semibold mb-2">
                Welcome to the Hydrogen Health & Wellness Assistant
              </h3>
              <p className="mb-6">
                Ask any question about hydrogen and health - including
                hydrogen-rich water, hydrogen gas inhalation, and hydrogen
                baths. I'll provide scientifically-backed answers from
                peer-reviewed studies on how hydrogen can improve your wellness,
                support various health conditions, and aid in recovery.
              </p>

              <div className="grid grid-cols-1 gap-2 max-w-md mx-auto text-sm">
                {/* Show popular questions if available */}
                {popularQuestions.length > 0 ? (
                  <>
                    <div className="text-sm font-medium text-left mb-1 text-muted-foreground">
                      Popular Questions:
                    </div>
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
                      onClick={() =>
                        setInput(
                          "How does hydrogen water help with inflammation?",
                        )
                      }
                    >
                      How does hydrogen water help with inflammation?
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() =>
                        setInput(
                          "What benefits can I expect from inhaling molecular hydrogen gas?",
                        )
                      }
                    >
                      What benefits can I expect from inhaling molecular
                      hydrogen gas?
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() =>
                        setInput("Can hydrogen baths improve skin conditions?")
                      }
                    >
                      Can hydrogen baths improve skin conditions?
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() =>
                        setInput(
                          "What's the scientific evidence for hydrogen therapy in athletic recovery?",
                        )
                      }
                    >
                      What's the scientific evidence for hydrogen therapy in
                      athletic recovery?
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() =>
                        setInput(
                          "Is hydrogen-enriched bath water beneficial for skin conditions?",
                        )
                      }
                    >
                      Is hydrogen-enriched bath water beneficial for skin
                      conditions?
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
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`rounded-lg px-4 py-2 max-w-[80%] ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>

                  {/* Feedback buttons for assistant messages */}
                  {message.role === "assistant" &&
                    message.id &&
                    !feedbackSubmitted &&
                    index === messages.length - 1 && (
                      <div className="flex justify-start pl-4 space-x-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-primary h-7"
                                onClick={() =>
                                  submitFeedback(message.id!, "helpful")
                                }
                              >
                                <ThumbsUp className="h-3 w-3 mr-1" />
                                Helpful
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                Mark this response as helpful
                              </p>
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
                                onClick={() =>
                                  submitFeedback(message.id!, "unhelpful")
                                }
                              >
                                <ThumbsDown className="h-3 w-3 mr-1" />
                                Not helpful
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                Mark this response as not helpful
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}

                  {/* Feedback submitted confirmation */}
                  {message.role === "assistant" &&
                    message.id &&
                    feedbackSubmitted &&
                    index === messages.length - 1 && (
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
                      {source.authors} (
                      {new Date(source.publishDate).getFullYear()})
                      {source.doi && source.doi !== "No DOI available" && (
                        <>
                          {" "}
                          • DOI:{" "}
                          <a
                            href={`https://doi.org/${source.doi}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {source.doi}
                          </a>
                        </>
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

            {/* Product recommendations for hydrogen health-related queries */}
            {productRecommendations.length > 0 && (
              <div className="mt-4 p-3 bg-teal-50 dark:bg-teal-950 rounded-md border border-teal-200 dark:border-teal-800">
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <ShoppingBag className="h-4 w-4" /> Recommended Products for
                  Hydrogen Health
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {productRecommendations.map((product, index) => (
                    <a
                      key={index}
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-3 p-2 rounded-md hover:bg-teal-100 dark:hover:bg-teal-900 transition-colors"
                    >
                      {product.imageUrl && (
                        <div className="w-16 h-16 shrink-0 rounded overflow-hidden border border-gray-200 dark:border-gray-700">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h5 className="font-medium text-teal-600 dark:text-teal-400">
                          {product.name}
                        </h5>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {product.description}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Default Echo Water promotion when no specific product recommendations */}
            {productRecommendations.length === 0 &&
              messages.length > 0 &&
              messages[messages.length - 1].role === "assistant" && (
                <div className="mt-4 p-3 bg-teal-50 dark:bg-teal-950 rounded-md border border-teal-200 dark:border-teal-800">
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                    <ShoppingBag className="h-4 w-4" /> Looking for hydrogen
                    products?
                  </h4>
                  <p className="text-xs mt-1 mb-2 text-muted-foreground">
                    Visit{" "}
                    <a
                      href="https://echowater.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 dark:text-teal-400 font-medium"
                    >
                      Echo Water
                    </a>{" "}
                    for hydrogen-rich water systems and wellness products.
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() =>
                      window.open("https://echowater.com", "_blank")
                    }
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
