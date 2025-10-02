import React, { Component, ErrorInfo, ReactNode } from "react";
import { ErrorDisplay } from "./loading-states";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch JavaScript errors anywhere in the child component tree,
 * log those errors, and display a fallback UI instead of the component tree that crashed.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to an error reporting service
    console.error("Error caught by ErrorBoundary:", error);
    console.error("Component stack:", errorInfo.componentStack);
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorDisplay
          title="Something went wrong"
          message={this.state.error?.message || "An unexpected error occurred"}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}
