import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Send, ThumbsUp, ThumbsDown, RefreshCcw, Brain } from "lucide-react";
import { Study } from "@/types";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

interface ChatbotDialogueProps {
  studyContext?: Study;
}

export default function ChatbotDialogue({
  studyContext,
}: ChatbotDialogueProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Add an initial message based on study context
  useEffect(() => {
    if (studyContext && messages.length === 0) {
      const welcomeMessage = {
        role: "assistant" as const,
        content: `Hello! I'm your research assistant for "${studyContext.title}". Ask me about the methods, results, or implications of this study. I can explain complex concepts or summarize key findings.`,
      };
      setMessages([welcomeMessage]);
    }
  }, [studyContext]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    // Add user message to the chat
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Prepare the conversation history and context
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const studyInfo = studyContext
        ? {
            title: studyContext.title,
            abstract: studyContext.abstract,
            methods: studyContext.methods,
            results: studyContext.results,
            conclusion: studyContext.conclusion,
            doi: studyContext.doi,
          }
        : undefined;

      // Make API request to get response
      const response = await apiRequest("POST", "/api/chat", {
        message: input,
        history: conversationHistory,
        studyContext: studyInfo,
      });

      if (!response.ok) {
        throw new Error("Failed to get a response");
      }

      const result = await response.json();

      // Add AI response to the chat
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            result.response ||
            "I'm sorry, I couldn't generate a response. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      // Add fallback message
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm experiencing technical difficulties right now. Please try again later.",
          timestamp: new Date(),
        },
      ]);

      toast({
        title: "Error",
        description: "Failed to get a response from the AI assistant.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format the timestamp for messages
  const formatTime = (timestamp?: Date) => {
    if (!timestamp) return "";
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(timestamp);
  };

  // Handle feedback on AI responses
  const sendFeedback = async (
    messageId: number | undefined,
    feedback: "positive" | "negative",
  ) => {
    if (!messageId) return;

    try {
      await apiRequest("POST", "/api/chat/feedback", {
        messageId,
        feedback,
      });

      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      console.error("Feedback error:", error);
      toast({
        title: "Error",
        description: "Failed to submit feedback.",
      });
    }
  };

  // Suggested questions based on study context
  const getSuggestedQuestions = () => {
    if (!studyContext) return [];

    return [
      `What are the key findings of this study about ${studyContext.title.split(" ").slice(0, 5).join(" ")}...?`,
      `Can you explain the methods used in simpler terms?`,
      `What are the practical implications of this research?`,
      `What limitations does this study have?`,
      `How does this research compare to other hydrogen studies?`,
    ];
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === "user"
                    ? "bg-primary text-white"
                    : "bg-secondary/20 text-foreground"
                }`}
              >
                <div className="prose prose-sm max-w-none">
                  {message.content}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs opacity-70">
                    {formatTime(message.timestamp)}
                  </span>

                  {message.role === "assistant" && (
                    <div className="flex items-center space-x-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                sendFeedback(message.id, "positive")
                              }
                            >
                              <ThumbsUp className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Helpful</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                sendFeedback(message.id, "negative")
                              }
                            >
                              <ThumbsDown className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Not helpful</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-secondary/20 p-3 rounded-lg text-foreground max-w-[80%]">
                <div className="flex items-center space-x-2">
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Suggested questions */}
      {messages.length <= 2 && (
        <div className="border-t border-border p-3">
          <h4 className="text-sm font-medium mb-2 flex items-center">
            <Brain className="w-3 h-3 mr-1" />
            Suggested Questions
          </h4>
          <div className="flex flex-wrap gap-2">
            {getSuggestedQuestions().map((question, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setInput(question);
                }}
              >
                {question.length > 40
                  ? `${question.substring(0, 40)}...`
                  : question}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border p-3 mt-auto">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about this study..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Responses are generated using AI and research data. Results may vary.
        </p>
      </div>
    </div>
  );
}
