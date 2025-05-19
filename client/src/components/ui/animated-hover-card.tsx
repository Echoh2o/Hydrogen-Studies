import React from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

interface AnimatedHoverCardProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  delay?: number;
  className?: string;
  contentClassName?: string;
}

/**
 * A hover card with animated entrance and exit
 */
export const AnimatedHoverCard = ({
  trigger,
  content,
  delay = 150,
  className,
  contentClassName,
}: AnimatedHoverCardProps) => {
  return (
    <HoverCard openDelay={delay} closeDelay={delay / 2}>
      <HoverCardTrigger asChild className={className}>
        {trigger}
      </HoverCardTrigger>
      <HoverCardContent className={cn("animate-in fade-in-50 zoom-in-95", contentClassName)}>
        {content}
      </HoverCardContent>
    </HoverCard>
  );
};