import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Database,
  FileText,
  Settings,
  Home,
  Activity,
  Target,
  Users,
  Menu,
  X,
  ChevronDown,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  /** Set for a plain link (no dropdown). */
  href?: string;
  /** Set for a dropdown group. */
  items?: NavItem[];
}

// Every admin route should appear somewhere in this structure — if you add
// a new admin page, add it here so it's reachable from the sidebar.
const NAV_GROUPS: NavGroup[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
  {
    label: "Studies",
    icon: Database,
    items: [
      { href: "/admin/studies", label: "All Studies" },
      { href: "/admin/studies/add", label: "Add Study" },
      { href: "/admin/research-database", label: "Research Database" },
      { href: "/admin/research-import", label: "Import from PubMed / CrossRef" },
      { href: "/admin/data-import", label: "Import from CSV / Excel" },
      { href: "/admin/pipeline", label: "Analysis Pipeline" },
      { href: "/admin/journal-date-updater", label: "Journal Date Updater" },
      { href: "/admin/deletion-ledger", label: "Deleted Studies" },
    ],
  },
  {
    label: "Content",
    icon: FileText,
    items: [
      { href: "/admin/blogs", label: "Blog Posts" },
      { href: "/admin/blogs/add", label: "New Blog Post" },
      { href: "/admin/blogs/generate", label: "Generate Blog (AI)" },
      { href: "/admin/blog-recommendations", label: "Blog Recommendations" },
      { href: "/admin/blog-categories", label: "Blog Categories" },
      { href: "/admin/multi-format", label: "Multi-Format Content" },
      { href: "/admin/image-generation", label: "Image Generation" },
      { href: "/admin/content-enrichment", label: "Content Enrichment" },
      { href: "/admin/batch-enrichment", label: "Batch Enrichment" },
      { href: "/admin/batch-categorization", label: "Batch Categorization" },
      { href: "/admin/content-optimization", label: "Content Optimization" },
      { href: "/admin/review-assistant", label: "Review Assistant" },
    ],
  },
  {
    label: "SEO & Links",
    icon: Target,
    items: [
      { href: "/admin/seo-strategy", label: "SEO Strategy" },
      { href: "/admin/links", label: "Internal Links" },
      { href: "/admin/redirects", label: "Redirects" },
      { href: "/admin/keyword-monitor", label: "Keyword Monitor" },
    ],
  },
  {
    label: "Analytics",
    icon: BarChart3,
    items: [
      { href: "/admin/analytics", label: "Content Analytics" },
      { href: "/admin/trends", label: "Trends Analysis" },
      { href: "/admin/monitoring", label: "System Monitoring" },
    ],
  },
  { label: "Users", icon: Users, href: "/admin/users" },
  { label: "Settings", icon: Settings, href: "/admin/settings" },
];

export default function AdminLayout({
  children,
  title,
  description,
}: AdminLayoutProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // True for an exact match on /admin, or a prefix match (so nested routes
  // like /admin/studies/edit/42 still highlight "All Studies").
  const isActive = (href: string): boolean => {
    if (href === "/admin") return location === "/admin";
    return location === href || location.startsWith(href + "/");
  };

  const isGroupActive = (group: NavGroup): boolean => {
    if (group.href) return isActive(group.href);
    return (group.items ?? []).some((item) => isActive(item.href));
  };

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
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={mobileMenuOpen}
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
                {NAV_GROUPS.map((group) => {
                  const Icon = group.icon;
                  const active = isGroupActive(group);
                  const baseClasses = cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-primary hover:bg-accent/50",
                  );

                  if (group.href) {
                    return (
                      <Link key={group.label} href={group.href} className={baseClasses}>
                        <Icon className="h-3.5 w-3.5" />
                        {group.label}
                      </Link>
                    );
                  }

                  return (
                    <DropdownMenu key={group.label}>
                      <DropdownMenuTrigger
                        className={cn(baseClasses, "outline-none")}
                        aria-label={`${group.label} menu`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {group.label}
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[220px]">
                        {group.items!.map((item) => (
                          <DropdownMenuItem key={item.href} asChild>
                            <Link
                              href={item.href}
                              className={cn(
                                "w-full cursor-pointer",
                                isActive(item.href) && "bg-accent text-accent-foreground",
                              )}
                            >
                              {item.label}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })}
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
                aria-label="Back to public site"
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

        {/* Mobile nav — all groups expanded with section headers */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b bg-background px-4 py-3 max-h-[calc(100vh-56px)] overflow-y-auto">
            <div className="space-y-4">
              {NAV_GROUPS.map((group) => {
                const Icon = group.icon;

                if (group.href) {
                  return (
                    <Link
                      key={group.label}
                      href={group.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                        isActive(group.href)
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {group.label}
                    </Link>
                  );
                }

                return (
                  <div key={group.label}>
                    <div className="flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {group.label}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {group.items!.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "block rounded-md pl-8 pr-3 py-1.5 text-sm",
                            isActive(item.href)
                              ? "bg-accent text-accent-foreground font-medium"
                              : "text-muted-foreground hover:bg-accent/50",
                          )}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
                >
                  <Home className="h-4 w-4" />
                  Back to public site
                </Link>
              </div>
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
