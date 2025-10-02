import React from "react";
import { motion } from "framer-motion";
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
      <HoverCardContent
        className={cn("animate-in fade-in-50 zoom-in-95", contentClassName)}
      >
        {content}
      </HoverCardContent>
    </HoverCard>
  );
};

interface AnimatedGrowOnHoverProps {
  children: React.ReactNode;
  scale?: number;
  className?: string;
}

/**
 * A component that grows slightly when hovered
 */
export const AnimatedGrowOnHover = ({
  children,
  scale = 1.05,
  className,
}: AnimatedGrowOnHoverProps) => {
  return (
    <motion.div
      className={className}
      whileHover={{ scale }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
};

interface PulsingElementProps {
  children: React.ReactNode;
  isActive?: boolean;
  pulseColor?: string;
  className?: string;
}

/**
 * A component that pulses to draw attention
 */
export const PulsingElement = ({
  children,
  isActive = true,
  pulseColor = "rgba(var(--primary-rgb), 0.2)",
  className,
}: PulsingElementProps) => {
  return (
    <div className={cn("relative", className)}>
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-md"
          animate={{
            boxShadow: [
              `0 0 0 0 ${pulseColor}`,
              `0 0 0 8px ${pulseColor}`,
              `0 0 0 0 ${pulseColor}`,
            ],
          }}
          transition={{
            duration: 2,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "loop",
          }}
        />
      )}
      {children}
    </div>
  );
};
