import { useState } from 'react';
import { Link, useNavigate } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/components/auth/ProtectedRoute';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Droplets, 
  Menu, 
  X, 
  ChevronDown, 
  User, 
  LogOut, 
  Settings, 
  Shield,
  UserCircle,
  LogIn,
  UserPlus,
  Users,
  LayoutDashboard
} from "lucide-react";

export default function SiteHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [, navigate] = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, user, userRole, isLoading } = useAuth();

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => 
      apiRequest('/api/auth/logout', {
        method: 'POST',
      }),
    onSuccess: () => {
      // Clear cached auth data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/check-session'] });
      
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out.',
      });
      
      navigate('/');
    },
    onError: () => {
      toast({
        title: 'Logout failed',
        description: 'There was a problem logging out. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return 'U';
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  // Check if user is admin or editor
  const isAdminOrEditor = userRole === 'admin' || userRole === 'editor';

  return (
    <nav className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <Link href="/">
              <div className="flex items-center space-x-2 cursor-pointer">
                <Droplets className="h-8 w-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Hydrogen Studies</span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {/* Studies Dropdown */}
            <div className="relative group">
              <button className="text-gray-700 hover:text-blue-600 transition-colors flex items-center space-x-1">
                <span>Studies</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="p-2 space-y-1">
                  <Link href="/studies" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    All Studies
                  </Link>
                  <Link href="/recent-studies" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    Recent Studies
                  </Link>
                  <Link href="/explore-by-condition" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    By Health Condition
                  </Link>
                  <Link href="/explore-by-body-system" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    By Body System
                  </Link>
                  <Link href="/explore-by-life-stage" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    By Life Stage
                  </Link>
                  <Link href="/explore-by-delivery-method" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    By Delivery Method
                  </Link>
                  <Link href="/explore-by-benefit" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    By Health Benefit
                  </Link>
                  <Link href="/insights" className="block px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors">
                    Research Insights
                  </Link>
                </div>
              </div>
            </div>
            
            <Link href="/blog" className="text-gray-700 hover:text-blue-600 transition-colors">
              Blog
            </Link>
            <Link href="/benefits" className="text-gray-700 hover:text-blue-600 transition-colors">
              Benefits
            </Link>
            <Link href="/research-analytics" className="text-gray-700 hover:text-blue-600 transition-colors">
              Analytics  
            </Link>
            <Link href="/products" className="text-gray-700 hover:text-blue-600 transition-colors">
              Products
            </Link>
            <Link href="/chat" className="text-gray-700 hover:text-blue-600 transition-colors">
              AI Assistant
            </Link>

            {/* User Menu */}
            {isLoading ? (
              <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
            ) : isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.profileImageUrl} alt={user.username || user.email} />
                      <AvatarFallback>{getUserInitials()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}`
                          : user.username || 'User'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                      {userRole && (
                        <Badge className="mt-1 w-fit" variant="secondary">
                          {userRole}
                        </Badge>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  
                  {isAdminOrEditor && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/admin')}>
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Admin Dashboard</span>
                      </DropdownMenuItem>
                      {userRole === 'admin' && (
                        <DropdownMenuItem onClick={() => navigate('/admin/users')}>
                          <Users className="mr-2 h-4 w-4" />
                          <span>Manage Users</span>
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{logoutMutation.isPending ? 'Logging out...' : 'Log out'}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/login')}
                  data-testid="button-login"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => navigate('/register')}
                  data-testid="button-register"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Sign Up
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="px-4 py-3 space-y-2">
              {/* User Section for Mobile */}
              {!isLoading && (
                <div className="border-b pb-3 mb-3">
                  {isAuthenticated && user ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3 px-4 py-2">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.profileImageUrl} alt={user.username || user.email} />
                          <AvatarFallback>{getUserInitials()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {user.firstName && user.lastName 
                              ? `${user.firstName} ${user.lastName}`
                              : user.username || 'User'}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                          {userRole && (
                            <Badge className="mt-1" variant="secondary" size="sm">
                              {userRole}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <Link href="/profile">
                        <div 
                          className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <User className="inline mr-2 h-4 w-4" />
                          Profile
                        </div>
                      </Link>
                      
                      <Link href="/settings">
                        <div 
                          className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <Settings className="inline mr-2 h-4 w-4" />
                          Settings
                        </div>
                      </Link>
                      
                      {isAdminOrEditor && (
                        <>
                          <Link href="/admin">
                            <div 
                              className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              <Shield className="inline mr-2 h-4 w-4" />
                              Admin Dashboard
                            </div>
                          </Link>
                          {userRole === 'admin' && (
                            <Link href="/admin/users">
                              <div 
                                className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                                onClick={() => setIsMobileMenuOpen(false)}
                              >
                                <Users className="inline mr-2 h-4 w-4" />
                                Manage Users
                              </div>
                            </Link>
                          )}
                        </>
                      )}
                      
                      <button
                        onClick={() => {
                          handleLogout();
                          setIsMobileMenuOpen(false);
                        }}
                        disabled={logoutMutation.isPending}
                        className="w-full text-left block px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                      >
                        <LogOut className="inline mr-2 h-4 w-4" />
                        {logoutMutation.isPending ? 'Logging out...' : 'Log out'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Link href="/login">
                        <div 
                          className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm font-medium"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <LogIn className="inline mr-2 h-4 w-4" />
                          Login
                        </div>
                      </Link>
                      <Link href="/register">
                        <div 
                          className="block px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors text-sm font-medium text-center"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <UserPlus className="inline mr-2 h-4 w-4" />
                          Sign Up
                        </div>
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Studies Section */}
              <div className="border-b pb-2 mb-2">
                <div className="px-4 py-2 text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Studies
                </div>
                <Link href="/studies">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    All Studies
                  </div>
                </Link>
                <Link href="/recent-studies">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Recent Studies
                  </div>
                </Link>
                <Link href="/explore-by-condition">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    By Health Condition
                  </div>
                </Link>
                <Link href="/explore-by-body-system">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    By Body System
                  </div>
                </Link>
                <Link href="/explore-by-life-stage">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    By Life Stage
                  </div>
                </Link>
                <Link href="/explore-by-delivery-method">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    By Delivery Method
                  </div>
                </Link>
                <Link href="/explore-by-benefit">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    By Health Benefit
                  </div>
                </Link>
                <Link href="/insights">
                  <div 
                    className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Research Insights
                  </div>
                </Link>
              </div>
              
              <Link href="/blog">
                <div 
                  className="block px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Blog
                </div>
              </Link>
              <Link href="/benefits">
                <div 
                  className="block px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Benefits
                </div>
              </Link>
              <Link href="/research-analytics">
                <div 
                  className="block px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Analytics
                </div>
              </Link>
              <Link href="/products">
                <div 
                  className="block px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Products
                </div>
              </Link>
              <Link href="/chat">
                <div 
                  className="block px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  AI Assistant
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}