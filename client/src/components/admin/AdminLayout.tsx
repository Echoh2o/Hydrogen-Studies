import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Database,
  FileText,
  Settings,
  Search,
  Home,
  Activity,
  Target,
  Users,
  Link2,
  Menu,
  X,
} from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export default function AdminLayout({
  children,
  title,
  description,
}: AdminLayoutProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if a nav item is active (supports child routes)
  const isActive = (href: string) => {
    if (href === "/admin") return location === "/admin";
    return location === href || location.startsWith(href + "/");
  };

  // Simplified admin navigation
  const navSections = [
    {
      title: "Main",
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { href: "/admin/studies", label: "Studies", icon: Database },
        { href: "/admin/research-database", label: "Import Studies", icon: Search },
        { href: "/admin/blogs", label: "Blogs", icon: FileText },
        { href: "/admin/seo-strategy", label: "SEO", icon: Target },
        { href: "/admin/links", label: "Links", icon: Link2 },
        { href: "/admin/monitoring", label: "System", icon: Activity },
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/settings", label: "Settings", icon: Settings },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{title} | HydrogenStudies Admin</title>
      </Helmet>

      <div className="flex min-h-screen flex-col">
        {/* Top navigation */}
        <header className="sticky top-0 z-40 border-b bg-background">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-4">
              {/* Mobile menu toggle */}
              <button
                className="md:hidden p-1.5 rounded-md hover:bg-accent"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              <Link href="/admin" className="flex items-center">
                <span className="font-semibold tracking-tight text-lg">
                  HydrogenStudies
                </span>
                <span className="bg-primary text-primary-foreground ml-2 rounded-sm px-1.5 py-0.5 text-xs font-medium">
                  Admin
                </span>
              </Link>

              <nav className="hidden md:flex items-center ml-6 gap-1">
                {navSections[0].items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      isActive(href)
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-primary hover:bg-accent/50",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Link>
                ))}
                <span className="mx-2 h-4 w-px bg-border" />
                <Link
                  href="/"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-primary hover:bg-accent/50 transition-colors"
                >
                  <Home className="h-3.5 w-3.5" />
                  Site
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="md:hidden flex items-center text-xs text-muted-foreground"
              >
                <Home className="h-4 w-4" />
              </Link>
              <span className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full">
                <span className="flex h-full w-full items-center justify-center bg-muted text-sm">
                  A
                </span>
              </span>
            </div>
          </div>
        </header>

        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b bg-background px-4 py-3">
            <div className="grid grid-cols-2 gap-2">
              {navSections.flatMap((section) =>
                section.items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent transition-colors",
                      isActive(href)
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground",
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}

        {/* Main content — full width, no sidebar */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
