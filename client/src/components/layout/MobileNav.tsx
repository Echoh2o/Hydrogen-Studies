import { memo } from "react";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LogOut,
  Settings,
  Shield,
  LogIn,
  UserPlus,
  Users,
} from "lucide-react";
import { studyLinks, mainLinks } from "./navLinks";

interface MobileNavProps {
  isOpen: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  user: any;
  userRole: string | null;
  isAdminOrEditor: boolean;
  getUserInitials: () => string;
  handleLogout: () => void;
  logoutIsPending: boolean;
  onClose: () => void;
}

const MobileNav = memo(function MobileNav({
  isOpen,
  isLoading,
  isAuthenticated,
  user,
  userRole,
  isAdminOrEditor,
  getUserInitials,
  handleLogout,
  logoutIsPending,
  onClose,
}: MobileNavProps) {
  if (!isOpen) return null;

  return (
    <div className="md:hidden absolute top-full left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 max-h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="px-4 py-3 space-y-2">
        {/* User Section for Mobile */}
        {!isLoading && (
          <div className="border-b pb-3 mb-3">
            {isAuthenticated && user ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-3 px-4 py-2">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={user.profileImageUrl}
                      alt={user.username || user.email}
                    />
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.username || "User"}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                    {userRole && (
                      <Badge className="mt-1 text-xs" variant="secondary">
                        {userRole}
                      </Badge>
                    )}
                  </div>
                </div>

                {!isAdminOrEditor && (
                  <Link href="/my-dashboard">
                    <div
                      className="block px-4 py-2 text-gray-700 hover:bg-teal-50 hover:text-teal-600 rounded-lg transition-colors text-sm"
                      onClick={onClose}
                    >
                      <Settings className="inline mr-2 h-4 w-4" />
                      My Dashboard
                    </div>
                  </Link>
                )}

                {isAdminOrEditor && (
                  <>
                    <Link href="/admin">
                      <div
                        className="block px-4 py-2 text-gray-700 hover:bg-teal-50 hover:text-teal-600 rounded-lg transition-colors text-sm"
                        onClick={onClose}
                      >
                        <Shield className="inline mr-2 h-4 w-4" />
                        Admin Dashboard
                      </div>
                    </Link>
                    {userRole === "admin" && (
                      <Link href="/admin/users">
                        <div
                          className="block px-4 py-2 text-gray-700 hover:bg-teal-50 hover:text-teal-600 rounded-lg transition-colors text-sm"
                          onClick={onClose}
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
                    onClose();
                  }}
                  disabled={logoutIsPending}
                  className="w-full text-left block px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                >
                  <LogOut className="inline mr-2 h-4 w-4" />
                  {logoutIsPending
                    ? "Logging out..."
                    : "Log out"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Link href="/login">
                  <div
                    className="block px-4 py-2 text-gray-700 hover:bg-teal-50 hover:text-teal-600 rounded-lg transition-colors text-sm font-medium"
                    onClick={onClose}
                  >
                    <LogIn className="inline mr-2 h-4 w-4" />
                    Login
                  </div>
                </Link>
                <Link href="/register">
                  <div
                    className="block px-4 py-2 bg-teal-600 text-white hover:bg-teal-700 rounded-lg transition-colors text-sm font-medium text-center"
                    onClick={onClose}
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
          {studyLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div
                className="block px-4 py-2 text-gray-700 hover:bg-teal-50 hover:text-teal-600 rounded-lg transition-colors text-sm"
                onClick={onClose}
              >
                {link.label}
              </div>
            </Link>
          ))}
        </div>

        {mainLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <div
              className="block px-4 py-3 text-gray-700 hover:bg-teal-50 hover:text-teal-600 rounded-lg transition-colors"
              onClick={onClose}
            >
              {link.label}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
});

export default MobileNav;
