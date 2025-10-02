/**
 * Responsive design utilities and hooks for mobile optimization
 */
import { useEffect, useState } from "react";

// Define standard breakpoints for the application
export const breakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

export type Breakpoint = keyof typeof breakpoints;

/**
 * Hook to detect screen size based on breakpoints
 * @returns Object containing boolean flags for different screen sizes
 */
export function useScreenSize() {
  const [screenSize, setScreenSize] = useState({
    isMobile: false, // < 640px
    isTablet: false, // >= 640px && < 1024px
    isDesktop: false, // >= 1024px
    isLargeDesktop: false, // >= 1280px
  });

  useEffect(() => {
    // Handler to call on window resize
    const handleResize = () => {
      const width = window.innerWidth;
      setScreenSize({
        isMobile: width < breakpoints.sm,
        isTablet: width >= breakpoints.sm && width < breakpoints.lg,
        isDesktop: width >= breakpoints.lg,
        isLargeDesktop: width >= breakpoints.xl,
      });
    };

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Call handler right away so state gets updated with initial window size
    handleResize();

    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return screenSize;
}

/**
 * Hook to check if the current screen width is at least the specified breakpoint
 * @param breakpoint The minimum breakpoint to check for
 * @returns True if screen width is greater than or equal to the specified breakpoint
 */
export function useBreakpoint(breakpoint: Breakpoint) {
  const [isAboveBreakpoint, setIsAboveBreakpoint] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsAboveBreakpoint(window.innerWidth >= breakpoints[breakpoint]);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return isAboveBreakpoint;
}

/**
 * Helper function to generate responsive class strings for different breakpoints
 * @param baseClasses Classes to apply to all screen sizes
 * @param responsiveClasses Classes keyed by breakpoint
 * @returns Combined class string
 */
export function responsiveClasses(
  baseClasses: string,
  responsiveClasses: Partial<Record<Breakpoint, string>>,
) {
  let classes = baseClasses;

  for (const [breakpoint, value] of Object.entries(responsiveClasses)) {
    const prefix = breakpoint === "xs" ? "" : `${breakpoint}:`;
    classes += ` ${prefix}${value}`;
  }

  return classes;
}

/**
 * Get responsive padding classes based on screen size
 * Useful for consistent spacing across the application
 */
export function getResponsivePadding(
  size: "small" | "medium" | "large" = "medium",
) {
  switch (size) {
    case "small":
      return "px-4 py-2 sm:px-6 lg:px-8";
    case "medium":
      return "px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8";
    case "large":
      return "px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10";
    default:
      return "px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8";
  }
}

/**
 * Helper function to get appropriate font size classes based on screen size
 * Ensures readability on all devices
 */
export function getResponsiveFontSize(
  type: "heading1" | "heading2" | "heading3" | "body" | "small",
) {
  switch (type) {
    case "heading1":
      return "text-2xl sm:text-3xl lg:text-4xl font-bold";
    case "heading2":
      return "text-xl sm:text-2xl lg:text-3xl font-semibold";
    case "heading3":
      return "text-lg sm:text-xl lg:text-2xl font-medium";
    case "body":
      return "text-base sm:text-base lg:text-lg";
    case "small":
      return "text-xs sm:text-sm lg:text-base";
    default:
      return "text-base";
  }
}

/**
 * Hook to detect device type based on user agent
 * This is not perfectly reliable but provides additional context
 */
export function useDeviceDetect() {
  const [deviceInfo, setDeviceInfo] = useState({
    isMobileDevice: false,
    isTabletDevice: false,
    isDesktopDevice: true,
    isIOS: false,
    isAndroid: false,
  });

  useEffect(() => {
    const userAgent =
      typeof navigator === "undefined" ? "" : navigator.userAgent;

    const isMobileDevice =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        userAgent,
      );
    const isTabletDevice = /(iPad|tablet|Tablet|Android(?!.*Mobile))/i.test(
      userAgent,
    );
    const isIOS = /iPad|iPhone|iPod/i.test(userAgent);
    const isAndroid = /Android/i.test(userAgent);

    setDeviceInfo({
      isMobileDevice,
      isTabletDevice,
      isDesktopDevice: !isMobileDevice && !isTabletDevice,
      isIOS,
      isAndroid,
    });
  }, []);

  return deviceInfo;
}

/**
 * Hook to handle touch interactions better on mobile devices
 */
export function useTouchFriendly(
  elementRef: React.RefObject<HTMLElement>,
  options = { clickRadius: 10 },
) {
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const { clickRadius } = options;
    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      // Calculate distance moved
      const distanceX = Math.abs(touchEndX - touchStartX);
      const distanceY = Math.abs(touchEndY - touchStartY);

      // If the touch barely moved (small radius), treat it as a tap/click
      if (distanceX < clickRadius && distanceY < clickRadius) {
        // Enhance the target area for small elements
        const clickEvent = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        element.dispatchEvent(clickEvent);
      }
    };

    element.addEventListener("touchstart", handleTouchStart);
    element.addEventListener("touchend", handleTouchEnd);

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [elementRef, options]);
}
