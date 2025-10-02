/**
 * Content Analytics Hook for Performance Tracking
 * Provides utilities for tracking user interactions and engagement
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useLocation } from "wouter";

// Content types matching backend
export enum ContentType {
  STUDY = "study",
  BLOG = "blog",
  ARTICLE = "article",
}

// Engagement actions
export enum EngagementAction {
  VIEW = "view",
  LIKE = "like",
  SHARE = "share",
  DOWNLOAD = "download",
  COMMENT = "comment",
  CLICK = "click",
  SCROLL = "scroll",
  TIME_SPENT = "time_spent",
}

interface TrackingOptions {
  contentType: ContentType;
  contentId: number;
  userId?: string;
}

interface EngagementData {
  action: EngagementAction;
  actionValue?: string;
  timeSpent?: number;
  scrollDepth?: number;
}

// Get or create session ID
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem("analyticsSessionId");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem("analyticsSessionId", sessionId);
  }
  return sessionId;
};

// Get device type
const getDeviceType = (): "mobile" | "tablet" | "desktop" => {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
};

// Get browser type
const getBrowserType = (): string => {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("chrome")) return "chrome";
  if (userAgent.includes("firefox")) return "firefox";
  if (userAgent.includes("safari")) return "safari";
  if (userAgent.includes("edge")) return "edge";
  return "other";
};

// Batch tracking for efficiency
class TrackingBatcher {
  private queue: Array<{ type: "view" | "engagement"; data: any }> = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly batchSize = 10;
  private readonly batchDelay = 2000; // 2 seconds

  add(event: { type: "view" | "engagement"; data: any }) {
    this.queue.push(event);

    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.batchDelay);
    }
  }

  async flush() {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    try {
      await fetch("/api/analytics/batch-track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ events }),
      });
    } catch (error) {
      console.error("Failed to batch track events:", error);
      // Re-queue failed events
      this.queue = [...events, ...this.queue];
    }
  }
}

const trackingBatcher = new TrackingBatcher();

/**
 * Main content analytics hook
 */
export function useContentAnalytics(options: TrackingOptions) {
  const [location] = useLocation();
  const startTimeRef = useRef<number>(Date.now());
  const scrollDepthRef = useRef<number>(0);
  const hasTrackedViewRef = useRef<boolean>(false);
  const sessionId = getSessionId();

  // Track page view
  const trackView = useCallback(async () => {
    if (hasTrackedViewRef.current) return;
    hasTrackedViewRef.current = true;

    const viewData = {
      contentType: options.contentType,
      contentId: options.contentId,
      userId: options.userId,
      sessionId,
      deviceType: getDeviceType(),
      browserType: getBrowserType(),
      referrerType: document.referrer ? "external" : "direct",
      referrerValue: document.referrer,
    };

    // Add to batch or send immediately for important views
    if (options.contentType === ContentType.STUDY) {
      // Track studies immediately
      try {
        await fetch("/api/analytics/track-view", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(viewData),
        });
      } catch (error) {
        console.error("Failed to track view:", error);
      }
    } else {
      trackingBatcher.add({ type: "view", data: viewData });
    }
  }, [options, sessionId]);

  // Track engagement
  const trackEngagement = useCallback(
    async (data: EngagementData) => {
      const engagementData = {
        contentType: options.contentType,
        contentId: options.contentId,
        userId: options.userId,
        sessionId,
        ...data,
      };

      // Add to batch
      trackingBatcher.add({ type: "engagement", data: engagementData });
    },
    [options, sessionId],
  );

  // Track time spent
  const trackTimeSpent = useCallback(() => {
    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
    trackEngagement({
      action: EngagementAction.TIME_SPENT,
      timeSpent,
    });
  }, [trackEngagement]);

  // Track scroll depth
  const trackScroll = useCallback(() => {
    const scrollHeight =
      document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = window.scrollY;
    const scrollPercent = Math.round((scrolled / scrollHeight) * 100);

    if (scrollPercent > scrollDepthRef.current) {
      scrollDepthRef.current = scrollPercent;

      // Track significant scroll milestones
      if (
        scrollPercent === 25 ||
        scrollPercent === 50 ||
        scrollPercent === 75 ||
        scrollPercent === 100
      ) {
        trackEngagement({
          action: EngagementAction.SCROLL,
          scrollDepth: scrollPercent,
        });
      }
    }
  }, [trackEngagement]);

  // Track click on related content
  const trackClick = useCallback(
    (target: string) => {
      trackEngagement({
        action: EngagementAction.CLICK,
        actionValue: target,
      });
    },
    [trackEngagement],
  );

  // Track social share
  const trackShare = useCallback(
    (platform: string) => {
      trackEngagement({
        action: EngagementAction.SHARE,
        actionValue: platform,
      });
    },
    [trackEngagement],
  );

  // Track download
  const trackDownload = useCallback(
    (fileType: string) => {
      trackEngagement({
        action: EngagementAction.DOWNLOAD,
        actionValue: fileType,
      });
    },
    [trackEngagement],
  );

  // Track like
  const trackLike = useCallback(() => {
    trackEngagement({
      action: EngagementAction.LIKE,
    });
  }, [trackEngagement]);

  // Setup tracking on mount
  useEffect(() => {
    // Track view after a short delay to ensure content is loaded
    const viewTimer = setTimeout(trackView, 500);

    // Track scroll
    const handleScroll = () => {
      requestAnimationFrame(trackScroll);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Track time spent on unmount or visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        trackTimeSpent();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimeout(viewTimer);
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      // Final time tracking
      trackTimeSpent();

      // Flush any remaining events
      trackingBatcher.flush();
    };
  }, [trackView, trackScroll, trackTimeSpent]);

  // Reset tracking when location changes
  useEffect(() => {
    hasTrackedViewRef.current = false;
    startTimeRef.current = Date.now();
    scrollDepthRef.current = 0;
  }, [location]);

  return {
    trackClick,
    trackShare,
    trackDownload,
    trackLike,
    trackEngagement,
  };
}

/**
 * Hook for tracking content recommendations
 */
export function useRecommendations() {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const sessionId = getSessionId();

  const fetchRecommendations = useCallback(
    async (limit: number = 5) => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/analytics/recommendations?sessionId=${sessionId}&limit=${limit}`,
        );
        if (response.ok) {
          const data = await response.json();
          setRecommendations(data.recommendations);
        }
      } catch (error) {
        console.error("Failed to fetch recommendations:", error);
      } finally {
        setLoading(false);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    recommendations,
    loading,
    refresh: fetchRecommendations,
  };
}

/**
 * Hook for A/B testing
 */
export function useABTest(testId: string, variants: string[]) {
  const [variant, setVariant] = useState<string>("");
  const sessionId = getSessionId();

  useEffect(() => {
    // Get or assign variant
    const storageKey = `abtest_${testId}`;
    let assignedVariant = sessionStorage.getItem(storageKey);

    if (!assignedVariant && variants.length > 0) {
      // Randomly assign variant
      assignedVariant = variants[Math.floor(Math.random() * variants.length)];
      sessionStorage.setItem(storageKey, assignedVariant);
    }

    if (assignedVariant) {
      setVariant(assignedVariant);
    }
  }, [testId, variants]);

  const trackConversion = useCallback(async () => {
    if (!variant) return;

    try {
      await fetch("/api/analytics/track-engagement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentType: "ab_test",
          contentId: 0,
          sessionId,
          action: "conversion",
          actionValue: JSON.stringify({ testId, variant }),
        }),
      });
    } catch (error) {
      console.error("Failed to track A/B test conversion:", error);
    }
  }, [testId, variant, sessionId]);

  return {
    variant,
    trackConversion,
  };
}

/**
 * Component for tracking visible time
 */
export function VisibilityTracker({
  children,
  threshold = 0.5,
  onVisible,
  onHidden,
}: {
  children: React.ReactNode;
  threshold?: number;
  onVisible?: (duration: number) => void;
  onHidden?: (duration: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visibleStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleStartRef.current = Date.now();
          } else if (visibleStartRef.current) {
            const duration = Date.now() - visibleStartRef.current;
            onHidden?.(duration);
            visibleStartRef.current = null;
          }
        });
      },
      { threshold },
    );

    observer.observe(ref.current);

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
      if (visibleStartRef.current) {
        const duration = Date.now() - visibleStartRef.current;
        onVisible?.(duration);
      }
    };
  }, [threshold, onVisible, onHidden]);

  return <div ref={ref}>{children}</div>;
}
