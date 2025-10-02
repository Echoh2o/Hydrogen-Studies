import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
} from "framer-motion";

interface ParallaxScrollProps {
  children: React.ReactNode;
  speed?: number;
  className?: string;
  direction?: "up" | "down" | "left" | "right";
  containerTag?: keyof JSX.IntrinsicElements;
}

/**
 * A component that creates a parallax scrolling effect
 */
export const ParallaxScroll = ({
  children,
  speed = 0.2,
  className = "",
  direction = "up",
  containerTag = "div",
}: ParallaxScrollProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Calculate parallax effects for different directions
  const yRange =
    direction === "up" || direction === "down"
      ? [-100 * speed, 100 * speed]
      : [0, 0];
  const xRange =
    direction === "left" || direction === "right"
      ? [-100 * speed, 100 * speed]
      : [0, 0];

  // Invert direction if needed
  const finalYRange = direction === "down" ? yRange.map((v) => -v) : yRange;
  const finalXRange = direction === "right" ? xRange.map((v) => -v) : xRange;

  const y = useTransform(scrollYProgress, [0, 1], finalYRange);
  const x = useTransform(scrollYProgress, [0, 1], finalXRange);

  // Create smooth spring animation for the transforms
  const springY = useSpring(y, { stiffness: 100, damping: 30 });
  const springX = useSpring(x, { stiffness: 100, damping: 30 });

  // We'll use a simple div with motion
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x: springX, y: springY }}
    >
      {children}
    </motion.div>
  );
};

interface FadeInOnScrollProps {
  children: React.ReactNode;
  threshold?: number;
  direction?: "up" | "down" | "left" | "right";
  distance?: number;
  delay?: number;
  className?: string;
  once?: boolean;
}

/**
 * A component that fades in when scrolled into view
 */
export const FadeInOnScroll = ({
  children,
  threshold = 0.1,
  direction = "up",
  distance = 50,
  delay = 0,
  className = "",
  once = true,
}: FadeInOnScrollProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: threshold, once });

  const getInitialPosition = () => {
    switch (direction) {
      case "up":
        return { opacity: 0, y: distance };
      case "down":
        return { opacity: 0, y: -distance };
      case "left":
        return { opacity: 0, x: distance };
      case "right":
        return { opacity: 0, x: -distance };
      default:
        return { opacity: 0, y: distance };
    }
  };

  const getFinalPosition = () => {
    return { opacity: 1, y: 0, x: 0 };
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={getInitialPosition()}
      animate={isInView ? getFinalPosition() : getInitialPosition()}
      transition={{
        duration: 0.6,
        delay,
        ease: "easeOut",
      }}
    >
      {children}
    </motion.div>
  );
};

interface SequentialFadeInProps {
  children: React.ReactNode[];
  containerClassName?: string;
  threshold?: number;
  staggerDelay?: number;
  initialDelay?: number;
  once?: boolean;
}

/**
 * A component that fades in children sequentially when scrolled into view
 */
export const SequentialFadeIn = ({
  children,
  containerClassName = "",
  threshold = 0.1,
  staggerDelay = 0.1,
  initialDelay = 0,
  once = true,
}: SequentialFadeInProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: threshold, once });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: initialDelay,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  return (
    <motion.div
      ref={ref}
      className={containerClassName}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={containerVariants}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};
