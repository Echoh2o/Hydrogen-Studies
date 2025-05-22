import React, { useState } from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdvancedChatWidget } from './AdvancedChatWidget';

export function ChatLauncher() {
  const [isAdvancedChatOpen, setIsAdvancedChatOpen] = useState(false);

  return (
    <>
      {/* Floating Chat Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => setIsAdvancedChatOpen(true)}
          className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg"
          size="icon"
        >
          <div className="relative">
            <MessageCircle className="w-6 h-6 text-white" />
            <Sparkles className="w-3 h-3 text-white absolute -top-1 -right-1" />
          </div>
        </Button>
      </div>

      {/* Advanced Chat Widget */}
      <AdvancedChatWidget 
        isOpen={isAdvancedChatOpen} 
        onClose={() => setIsAdvancedChatOpen(false)} 
      />
    </>
  );
}