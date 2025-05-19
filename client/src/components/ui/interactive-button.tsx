import { motion } from "framer-motion";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface InteractiveButtonProps extends ButtonProps {
  pressEffect?: boolean;
  hoverScale?: number;
  hoverGlow?: boolean;
}

/**
 * An enhanced button component with hover and press animations
 */
export const InteractiveButton = forwardRef<HTMLButtonElement, InteractiveButtonProps>(
  ({ 
    children, 
    className, 
    pressEffect = true, 
    hoverScale = 1.03, 
    hoverGlow = false,
    disabled = false,
    ...props 
  }, ref) => {
    return (
      <motion.div
        whileHover={
          !disabled ? { 
            scale: hoverScale, 
            boxShadow: hoverGlow ? "0 0 8px rgba(var(--primary-rgb), 0.5)" : undefined
          } : undefined
        }
        whileTap={!disabled && pressEffect ? { scale: 0.98 } : undefined}
        transition={{ duration: 0.2 }}
      >
        <Button
          ref={ref}
          className={cn(
            "relative overflow-hidden transition-all duration-300",
            className,
            hoverGlow && "hover:shadow-glow"
          )}
          disabled={disabled}
          {...props}
        >
          {children}
        </Button>
      </motion.div>
    );
  }
);

InteractiveButton.displayName = "InteractiveButton";