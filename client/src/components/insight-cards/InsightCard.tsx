import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Share2, Download, Edit, Check } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { InteractiveButton } from '@/components/ui/interactive-button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Study } from '@/types';

// Card themes
const CARD_THEMES = {
  default: {
    bg: 'bg-gradient-to-br from-white to-zinc-100',
    border: 'border border-zinc-200',
    text: 'text-zinc-900',
    highlight: 'text-primary',
    accent: 'bg-primary/10'
  },
  blue: {
    bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
    border: 'border border-blue-200',
    text: 'text-blue-900',
    highlight: 'text-blue-600',
    accent: 'bg-blue-600/10'
  },
  green: {
    bg: 'bg-gradient-to-br from-green-50 to-green-100',
    border: 'border border-green-200',
    text: 'text-green-900',
    highlight: 'text-green-600',
    accent: 'bg-green-600/10'
  },
  purple: {
    bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
    border: 'border border-purple-200',
    text: 'text-purple-900',
    highlight: 'text-purple-600',
    accent: 'bg-purple-600/10'
  },
  amber: {
    bg: 'bg-gradient-to-br from-amber-50 to-amber-100',
    border: 'border border-amber-200',
    text: 'text-amber-900',
    highlight: 'text-amber-600',
    accent: 'bg-amber-600/10'
  }
};

// Layout options
const CARD_LAYOUTS = {
  centered: 'text-center',
  leftAligned: 'text-left',
  quote: 'text-left border-l-4 pl-4 border-primary'
};

// Font options
const CARD_FONTS = {
  sans: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono'
};

interface InsightCardProps {
  study: Study;
  insight?: string;
  isEditable?: boolean;
  className?: string;
}

export default function InsightCard({ 
  study, 
  insight: initialInsight,
  isEditable = false, 
  className
}: InsightCardProps) {
  // State for customization options
  const [theme, setTheme] = useState<keyof typeof CARD_THEMES>('default');
  const [layout, setLayout] = useState<keyof typeof CARD_LAYOUTS>('centered');
  const [font, setFont] = useState<keyof typeof CARD_FONTS>('sans');
  
  // State for the insight text content
  const [insight, setInsight] = useState(initialInsight || 
    `Key finding: ${study.title.split(':')[0] || study.title.substring(0, 80)}...`
  );
  
  // State for editing mode
  const [isEditing, setIsEditing] = useState(false);
  
  // Reference to the card for taking screenshot
  const cardRef = useRef<HTMLDivElement>(null);
  
  // State for success feedback
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Function to handle share functionality
  const handleShare = async () => {
    if (!cardRef.current) return;
    
    try {
      // Create a canvas from the card
      const canvas = await html2canvas(cardRef.current, {
        scale: 2, // Higher resolution
        backgroundColor: null,
      });
      
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob!);
        }, 'image/png');
      });
      
      // Create file from blob for sharing
      const file = new File([blob], `hydrogen-insight-${study.id}.png`, { type: 'image/png' });
      
      // Check if Web Share API is available
      if (navigator.share) {
        await navigator.share({
          title: `Research Insight: ${study.title.substring(0, 50)}...`,
          text: insight,
          files: [file]
        });
        
        showSuccessFeedback();
      } else {
        // Fallback if Web Share API is not available
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hydrogen-insight-${study.id}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showSuccessFeedback();
      }
    } catch (error) {
      console.error('Error sharing insight card:', error);
    }
  };
  
  // Function to download the card as image
  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
      });
      
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `hydrogen-insight-${study.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showSuccessFeedback();
    } catch (error) {
      console.error('Error downloading insight card:', error);
    }
  };
  
  // Show success feedback temporarily
  const showSuccessFeedback = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };
  
  // Toggle editing mode
  const toggleEditing = () => {
    setIsEditing(!isEditing);
  };
  
  return (
    <div className={cn("max-w-md mx-auto", className)}>
      {/* The actual insight card that will be captured */}
      <div 
        ref={cardRef}
        className={cn(
          "p-6 rounded-xl shadow-sm",
          CARD_THEMES[theme].bg,
          CARD_THEMES[theme].border,
          CARD_THEMES[theme].text,
          CARD_LAYOUTS[layout],
          CARD_FONTS[font]
        )}
      >
        {/* Card content */}
        <div className="flex flex-col space-y-4">
          {/* Metadata */}
          <div className="flex justify-between items-center text-xs">
            <span className={cn("px-2 py-1 rounded", CARD_THEMES[theme].accent)}>
              {study.category}
            </span>
            <span>HydrogenStudies.com</span>
          </div>
          
          {/* Main insight */}
          {isEditing ? (
            <textarea
              value={insight}
              onChange={(e) => setInsight(e.target.value)}
              className="w-full p-2 border rounded text-black bg-white/90"
              rows={4}
              placeholder="Enter the key insight from this study..."
              autoFocus
            />
          ) : (
            <p className="text-lg font-medium my-4 leading-relaxed">
              "{insight}"
            </p>
          )}
          
          {/* Attribution */}
          <div className="text-sm mt-2 opacity-75">
            <div>Source: {study.journal}</div>
            <div>Authors: {study.authors}</div>
          </div>
        </div>
      </div>
      
      {/* Card controls - only visible in UI, not in the exported image */}
      <div className="flex flex-col gap-4 mt-4">
        {/* Theme selector */}
        {isEditable && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Customize card appearance:</h4>
            
            <div className="flex flex-wrap gap-2">
              {Object.keys(CARD_THEMES).map((key) => (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "w-6 h-6 rounded-full border-2",
                    CARD_THEMES[key as keyof typeof CARD_THEMES].bg,
                    theme === key ? "ring-2 ring-primary ring-offset-2" : ""
                  )}
                  onClick={() => setTheme(key as keyof typeof CARD_THEMES)}
                />
              ))}
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <select 
                value={layout} 
                onChange={(e) => setLayout(e.target.value as keyof typeof CARD_LAYOUTS)}
                className="p-1 text-sm border rounded"
              >
                <option value="centered">Centered</option>
                <option value="leftAligned">Left Aligned</option>
                <option value="quote">Quote Style</option>
              </select>
              
              <select 
                value={font} 
                onChange={(e) => setFont(e.target.value as keyof typeof CARD_FONTS)}
                className="p-1 text-sm border rounded"
              >
                <option value="sans">Sans-serif</option>
                <option value="serif">Serif</option>
                <option value="mono">Monospace</option>
              </select>
            </div>
          </div>
        )}
        
        <div className="flex justify-between mt-2">
          {isEditable && (
            <InteractiveButton
              size="sm"
              variant={isEditing ? "default" : "outline"}
              onClick={toggleEditing}
              className="flex items-center gap-1"
            >
              {isEditing ? <Check className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
              {isEditing ? 'Save' : 'Edit Text'}
            </InteractiveButton>
          )}
          
          <div className="flex gap-2">
            <InteractiveButton
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="flex items-center gap-1"
              hoverScale={1.05}
            >
              <Download className="w-4 h-4" />
              {showSuccess ? 'Saved!' : 'Save'}
            </InteractiveButton>
            
            <InteractiveButton
              size="sm"
              variant="default"
              onClick={handleShare}
              className="flex items-center gap-1"
              hoverScale={1.05}
              hoverGlow={true}
            >
              <Share2 className="w-4 h-4" />
              {showSuccess ? 'Shared!' : 'Share'}
            </InteractiveButton>
          </div>
        </div>
      </div>
    </div>
  );
}