/**
 * ProtectedRoute Component
 * Wraps routes that require authentication and optionally specific roles
 */
import { useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, LogIn, AlertCircle } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  fallback?: ReactNode;
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  requiredRoles = [],
  requiredPermissions = [],
  fallback,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const [location, navigate] = useLocation();

  // Check session status
  const {
    data: session,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/auth/check-session"],
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    staleTime: 1 * 60 * 1000, // Consider stale after 1 minute
  });

  // Fetch user details if authenticated
  const { data: userDetails, isLoading: userLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    enabled: !!session?.authenticated,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isLoading && !session?.authenticated) {
      const redirectPath = `${redirectTo}?redirect=${encodeURIComponent(location)}`;
      navigate(redirectPath);
    }
  }, [session, isLoading, location, navigate, redirectTo]);

  // Show loading state
  if (isLoading || (session?.authenticated && userLoading)) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle authentication error
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Authentication Error
            </CardTitle>
            <CardDescription>
              There was a problem verifying your authentication status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error instanceof Error
                  ? error.message
                  : "Failed to verify authentication"}
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => navigate("/login")}
              className="w-full"
              data-testid="button-login-redirect"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authenticated - will redirect
  if (!session?.authenticated) {
    return null;
  }

  // Check role requirements
  if (requiredRoles.length > 0 && userDetails?.user) {
    const userRole = userDetails.user.role;
    const hasRequiredRole = requiredRoles.includes(userRole);

    if (!hasRequiredRole) {
      return (
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Shield className="h-5 w-5" />
                Access Denied
              </CardTitle>
              <CardDescription>
                You don't have permission to access this page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Insufficient Permissions</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2 mt-2">
                    <p>This page requires one of the following roles:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {requiredRoles.map((role) => (
                        <li key={role} className="text-sm capitalize">
                          {role}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-sm">
                      Your current role:{" "}
                      <span className="font-semibold capitalize">
                        {userRole}
                      </span>
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button
                  onClick={() => navigate("/")}
                  className="flex-1"
                  data-testid="button-home"
                >
                  Go to Home
                </Button>
                <Button
                  onClick={() => window.history.back()}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-back"
                >
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  // Check permission requirements
  if (requiredPermissions.length > 0 && userDetails?.user) {
    const userPermissions = userDetails.user.permissions || [];
    const hasRequiredPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasRequiredPermissions) {
      return (
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Shield className="h-5 w-5" />
                Access Denied
              </CardTitle>
              <CardDescription>
                You don't have the required permissions to access this page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Missing Permissions</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2 mt-2">
                    <p>This page requires the following permissions:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {requiredPermissions.map((permission) => (
                        <li key={permission} className="text-sm">
                          {permission}
                        </li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button
                  onClick={() => navigate("/")}
                  className="flex-1"
                  data-testid="button-home-permission"
                >
                  Go to Home
                </Button>
                <Button
                  onClick={() => window.history.back()}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-back-permission"
                >
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  // All checks passed - render the protected content
  return <>{children}</>;
}

// Export a hook for programmatic use
export function useAuth() {
  const { data: session, isLoading } = useQuery({
    queryKey: ["/api/auth/check-session"],
    staleTime: 1 * 60 * 1000,
  });

  const { data: userDetails } = useQuery({
    queryKey: ["/api/auth/me"],
    enabled: !!session?.authenticated,
    staleTime: 5 * 60 * 1000,
  });

  return {
    isAuthenticated: !!session?.authenticated,
    user: userDetails?.user || null,
    userRole: userDetails?.user?.role || null,
    isLoading,
    session,
  };
}
