import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/components/auth/ProtectedRoute";
import { useToast } from "@/hooks/use-toast";
import {
  Droplets,
  Menu,
  X,
} from "lucide-react";
import DesktopNav from "./DesktopNav";
import MobileNav from "./MobileNav";

export default function SiteHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, user, userRole, isLoading } = useAuth();

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileMenuOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["/api/auth/me"] });
      queryClient.removeQueries({ queryKey: ["/api/auth/check-session"] });
      queryClient.removeQueries({ queryKey: ["/api/auth"] });
      queryClient.setQueryData(["/api/auth/check-session"], { authenticated: false });
      queryClient.setQueryData(["/api/auth/me"], null);

      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });

      window.location.href = "/";
    },
    onError: () => {
      toast({
        title: "Logout failed",
        description: "There was a problem logging out. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  // Get user initials for avatar
  const getUserInitials = useCallback(() => {
    if (!user) return "U";
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  }, [user]);

  // Check if user is admin or editor
  const isAdminOrEditor = userRole === "admin" || userRole === "editor";

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  return (
    <nav className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/">
              <div className="flex items-center cursor-pointer group">
                <Droplets className="h-7 w-7 text-teal-600 mr-2.5 flex-shrink-0" />
                <div className="flex flex-col leading-none">
                  <span className="text-lg font-bold tracking-wider text-gray-900 uppercase" style={{ fontFamily: "'Montserrat', sans-serif", letterSpacing: '0.12em' }}>
                    Hydrogen Studies
                  </span>
                  <span className="text-[10px] font-medium tracking-widest text-teal-600 uppercase mt-0.5" style={{ fontFamily: "'Montserrat', sans-serif", letterSpacing: '0.18em' }}>
                    powered by echo water
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <DesktopNav
            isLoading={isLoading}
            isAuthenticated={isAuthenticated}
            user={user}
            userRole={userRole}
            isAdminOrEditor={isAdminOrEditor}
            getUserInitials={getUserInitials}
            handleLogout={handleLogout}
            logoutIsPending={logoutMutation.isPending}
            navigate={navigate}
          />

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              className="btn-tertiary btn-sm p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        <MobileNav
          isOpen={isMobileMenuOpen}
          isLoading={isLoading}
          isAuthenticated={isAuthenticated}
          user={user}
          userRole={userRole}
          isAdminOrEditor={isAdminOrEditor}
          getUserInitials={getUserInitials}
          handleLogout={handleLogout}
          logoutIsPending={logoutMutation.isPending}
          onClose={closeMobileMenu}
        />
      </div>
    </nav>
  );
}
