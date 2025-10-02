import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Check, AlertCircle } from "lucide-react";

interface AnimatedInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  animateLabel?: boolean;
  containerClassName?: string;
  labelClassName?: string;
  errorClassName?: string;
  successClassName?: string;
}

/**
 * An enhanced input component with animations for focus, error and success states
 */
export const AnimatedInput = React.forwardRef<
  HTMLInputElement,
  AnimatedInputProps
>(
  (
    {
      label,
      error,
      success = false,
      animateLabel = true,
      containerClassName,
      labelClassName,
      errorClassName,
      successClassName,
      className,
      value,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);
    const hasContent = React.useMemo(() => {
      return !!value && String(value).length > 0;
    }, [value]);

    return (
      <div className={cn("relative mb-4 w-full", containerClassName)}>
        {label && (
          <Label
            className={cn(
              "absolute left-3 transition-all duration-200 pointer-events-none",
              animateLabel && (focused || hasContent)
                ? "transform -translate-y-7 scale-90 text-primary"
                : "transform translate-y-2 text-muted-foreground",
              labelClassName,
            )}
          >
            {label}
          </Label>
        )}

        <Input
          ref={ref}
          className={cn(
            "transition-all duration-200",
            error ? "border-destructive focus:border-destructive" : "",
            success ? "border-green-500 focus:border-green-500" : "",
            focused ? "border-primary shadow-sm" : "",
            label && animateLabel ? "pt-3" : "",
            className,
          )}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex items-center mt-1 text-destructive text-sm",
                errorClassName,
              )}
            >
              <AlertCircle className="w-4 h-4 mr-1" />
              {error}
            </motion.div>
          )}

          {success && !error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 text-green-500",
                successClassName,
              )}
            >
              <Check className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

AnimatedInput.displayName = "AnimatedInput";

interface AnimatedTextareaProps {
  label?: string;
  error?: string;
  success?: boolean;
  animateLabel?: boolean;
  containerClassName?: string;
  textareaClassName?: string;
  labelClassName?: string;
  errorClassName?: string;
  [key: string]: any;
}

/**
 * An enhanced textarea component with animations for focus, error and success states
 */
export const AnimatedTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AnimatedTextareaProps
>(
  (
    {
      label,
      error,
      success = false,
      animateLabel = true,
      containerClassName,
      textareaClassName,
      labelClassName,
      errorClassName,
      ...props
    },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);
    const hasContent = React.useMemo(() => {
      return !!props.value && String(props.value).length > 0;
    }, [props.value]);

    return (
      <div className={cn("relative mb-4 w-full", containerClassName)}>
        {label && (
          <Label
            className={cn(
              "absolute left-3 transition-all duration-200 pointer-events-none",
              animateLabel && (focused || hasContent)
                ? "transform -translate-y-7 scale-90 text-primary"
                : "transform translate-y-2 text-muted-foreground",
              labelClassName,
            )}
          >
            {label}
          </Label>
        )}

        <Textarea
          ref={ref}
          className={cn(
            "transition-all duration-200",
            error ? "border-destructive focus:border-destructive" : "",
            success ? "border-green-500 focus:border-green-500" : "",
            focused ? "border-primary shadow-sm" : "",
            label && animateLabel ? "pt-6" : "",
            textareaClassName,
          )}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex items-center mt-1 text-destructive text-sm",
                errorClassName,
              )}
            >
              <AlertCircle className="w-4 h-4 mr-1" />
              {error}
            </motion.div>
          )}

          {success && !error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="absolute right-3 top-3 text-green-500"
            >
              <Check className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

AnimatedTextarea.displayName = "AnimatedTextarea";
