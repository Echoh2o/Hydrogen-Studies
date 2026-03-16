import { Component, ErrorInfo, ReactNode } from "react";
import { trackError } from "@/lib/error-tracking";
import { Button } from "./button";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import {
  AlertCircle,
  RefreshCw,
  Home,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  retryable?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  showDetails: boolean;
  isRecovering: boolean;
}

/**
 * Enhanced Error Boundary with retry mechanism and detailed error reporting
 */
export class EnhancedErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorCount: 0,
    showDetails: false,
    isRecovering: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console with full context
    console.error("Error caught by ErrorBoundary:", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    // Update state with error info
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send error to monitoring service in production
    if (process.env.NODE_ENV === "production") {
      this.reportErrorToService(error, errorInfo);
    }
  }

  private reportErrorToService(error: Error, errorInfo: ErrorInfo) {
    trackError(error, `ErrorBoundary${errorInfo.componentStack ? " | " + errorInfo.componentStack.split("\n")[1]?.trim() : ""}`);
    // Send to error tracking service (e.g., Sentry, LogRocket)
    // This is a placeholder - implement actual service integration
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    // TODO: Replace with actual service call (e.g., Sentry)
    // Error report is prepared but not yet sent to an external service
  }

  private handleRetry = () => {
    this.setState({ isRecovering: true });

    // Clear any existing timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    // Add slight delay to show recovery state
    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isRecovering: false,
      });
    }, 300);
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  private toggleDetails = () => {
    this.setState((prevState) => ({
      showDetails: !prevState.showDetails,
    }));
  };

  public componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private getErrorMessage(): string {
    const { error } = this.state;
    if (!error) return "An unexpected error occurred";

    // User-friendly error messages based on error type
    if (error.message.includes("Network")) {
      return "Network connection issue. Please check your internet connection.";
    }
    if (error.message.includes("Permission")) {
      return "You don't have permission to access this resource.";
    }
    if (error.message.includes("chunk")) {
      return "Application resources failed to load. Please refresh the page.";
    }
    if (error.message.includes("Cannot read")) {
      return "Something went wrong while loading the page content.";
    }

    // Fallback to error message in development, generic in production
    return true
      ? error.message
      : "Something unexpected happened. Our team has been notified.";
  }

  public render() {
    const {
      hasError,
      error,
      errorInfo,
      errorCount,
      showDetails,
      isRecovering,
    } = this.state;
    const { fallback, children, retryable = true } = this.props;

    if (isRecovering) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-4">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Recovering...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return <>{fallback}</>;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-6 w-6 text-destructive mt-0.5" />
                <div className="flex-1">
                  <CardTitle>Oops! Something went wrong</CardTitle>
                  <CardDescription className="mt-2">
                    {this.getErrorMessage()}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {errorCount > 2 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Multiple Errors Detected</AlertTitle>
                  <AlertDescription>
                    This component has encountered {errorCount} errors. If the
                    problem persists, please contact support.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap gap-2">
                {retryable && (
                  <Button
                    onClick={this.handleRetry}
                    variant="default"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                )}

                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go to Home
                </Button>

                {true && (
                  <Button
                    onClick={this.toggleDetails}
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                  >
                    {showDetails ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Hide Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Show Details
                      </>
                    )}
                  </Button>
                )}
              </div>

              {true &&
                showDetails &&
                errorInfo && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-1">
                            Error Message:
                          </h4>
                          <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                            {error.message}
                          </pre>
                        </div>

                        <div>
                          <h4 className="font-semibold text-sm mb-1">
                            Stack Trace:
                          </h4>
                          <pre className="text-xs bg-background p-2 rounded overflow-x-auto max-h-40 overflow-y-auto">
                            {error.stack}
                          </pre>
                        </div>

                        <div>
                          <h4 className="font-semibold text-sm mb-1">
                            Component Stack:
                          </h4>
                          <pre className="text-xs bg-background p-2 rounded overflow-x-auto max-h-40 overflow-y-auto">
                            {errorInfo.componentStack}
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

// Async Error Boundary for handling async component errors
export function AsyncErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <EnhancedErrorBoundary
      retryable={true}
      showDetails={true}
      onError={(error, errorInfo) => {
        // Additional async error handling
        if (error.message.includes("Failed to fetch")) {
          console.error("API request failed:", error);
        }
      }}
    >
      {children}
    </EnhancedErrorBoundary>
  );
}

// Page-level error boundary with custom styling
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <EnhancedErrorBoundary
      retryable={true}
      showDetails={true}
    >
      {children}
    </EnhancedErrorBoundary>
  );
}
