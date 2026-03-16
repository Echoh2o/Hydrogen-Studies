import { memo } from "react";
import { Link } from "wouter";
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
  ChevronDown,
  LogOut,
  Settings,
  Shield,
  LogIn,
  UserPlus,
  Users,
} from "lucide-react";
import { studyLinks, mainLinks } from "./navLinks";

interface DesktopNavProps {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: any;
  userRole: string | null;
  isAdminOrEditor: boolean;
  getUserInitials: () => string;
  handleLogout: () => void;
  logoutIsPending: boolean;
  navigate: (path: string) => void;
}

const DesktopNav = memo(function DesktopNav({
  isLoading,
  isAuthenticated,
  user,
  userRole,
  isAdminOrEditor,
  getUserInitials,
  handleLogout,
  logoutIsPending,
  navigate,
}: DesktopNavProps) {
  return (
    <div className="hidden md:flex items-center space-x-8">
      {/* Studies Dropdown */}
      <div className="relative group">
        <button className="text-gray-700 hover:text-teal-600 transition-colors flex items-center space-x-1">
          <span>Studies</span>
          <ChevronDown className="h-4 w-4" />
        </button>
        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          <div className="p-2 space-y-1">
            {studyLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-3 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-600 rounded-md transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {mainLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-gray-700 hover:text-teal-600 transition-colors"
        >
          {link.label}
        </Link>
      ))}

      {/* User Menu */}
      {isLoading ? (
        <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
      ) : isAuthenticated && user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={user.profileImageUrl}
                  alt={user.username || user.email}
                />
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
                    : user.username || "User"}
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

            {!isAdminOrEditor && (
              <DropdownMenuItem onClick={() => navigate("/my-dashboard")}>
                <Settings className="mr-2 h-4 w-4" />
                <span>My Dashboard</span>
              </DropdownMenuItem>
            )}

            {isAdminOrEditor && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/admin")}>
                  <Shield className="mr-2 h-4 w-4" />
                  <span>Admin Dashboard</span>
                </DropdownMenuItem>
                {userRole === "admin" && (
                  <DropdownMenuItem
                    onClick={() => navigate("/admin/users")}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <span>Manage Users</span>
                  </DropdownMenuItem>
                )}
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                handleLogout();
              }}
              disabled={logoutIsPending}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>
                {logoutIsPending ? "Logging out..." : "Log out"}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center space-x-2">
          <button
            className="btn-secondary btn-sm btn-icon-left"
            onClick={() => navigate("/login")}
            data-testid="button-login"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Login
          </button>
          <button
            className="btn-primary btn-sm btn-icon-left"
            onClick={() => navigate("/register")}
            data-testid="button-register"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Sign Up
          </button>
        </div>
      )}
    </div>
  );
});

export default DesktopNav;
