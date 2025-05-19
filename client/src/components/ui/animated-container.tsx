import { motion, MotionProps } from "framer-motion";
import React from "react";

interface AnimatedContainerProps extends MotionProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

/**
 * A container component that animates its children when they enter the viewport
 */
export const AnimatedContainer = ({
  children,
  delay = 0,
  className,
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
      className={className}
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
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => {
  return (
    <motion.div
      className={className}
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
  className,
  ...props
}: {
  children: React.ReactNode;
  customVariants?: any;
  className?: string;
  [key: string]: any;
}) => {
  const defaultVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { ease: "easeOut", duration: 0.4 } },
    exit: { opacity: 0, y: 20, transition: { ease: "easeIn", duration: 0.3 } }
  };

  return (
    <motion.div
      className={className}
      variants={customVariants || defaultVariants}
      {...props}
    >
      {children}
    </motion.div>
  );
};