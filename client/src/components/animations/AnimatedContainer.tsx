import { motion, HTMLMotionProps } from "framer-motion";
import React from "react";

interface AnimatedContainerProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  delay?: number;
}

/**
 * A container component that animates its children when they enter the viewport
 */
export const AnimatedContainer = ({
  children,
  delay = 0,
  ...props
}: AnimatedContainerProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{
        duration: 0.5,
        delay,
        ease: "easeOut"
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

/**
 * A staggered container that animates children with a delay between each one
 */
export const StaggeredContainer = ({
  children,
  ...props
}: {
  children: React.ReactNode;
  [key: string]: any;
}) => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.1
          }
        },
        exit: {
          transition: {
            staggerChildren: 0.05,
            staggerDirection: -1
          }
        }
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

/**
 * A component that can be used inside a StaggeredContainer
 */
export const StaggeredItem = ({
  children,
  customVariants,
  ...props
}: {
  children: React.ReactNode;
  customVariants?: any;
  [key: string]: any;
}) => {
  const defaultVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { ease: "easeOut", duration: 0.4 } },
    exit: { opacity: 0, y: 20, transition: { ease: "easeIn", duration: 0.3 } }
  };

  return (
    <motion.div
      variants={customVariants || defaultVariants}
      {...props}
    >
      {children}
    </motion.div>
  );
};

/**
 * A fade transition component for elements entering/exiting the DOM
 */
export const FadeTransition = ({
  children,
  ...props
}: {
  children: React.ReactNode;
  [key: string]: any;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      {...props}
    >
      {children}
    </motion.div>
  );
};