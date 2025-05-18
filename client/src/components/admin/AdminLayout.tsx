import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Helmet } from 'react-helmet';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Database,
  FileText,
  Upload,
  Settings,
  UserCog,
  Search,
  BarChart2,
  Home,
  RefreshCw,
  Calendar
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export default function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const [location] = useLocation();
  
  const mainNavItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/studies", label: "Studies", icon: Database },
    { href: "/admin/blogs", label: "Blogs", icon: FileText },
    { href: "/admin/research-import", label: "Research Import", icon: Search },
    { href: "/admin/research-database", label: "Research Database", icon: Database },
    { href: "/admin/data-import", label: "Data Import", icon: Upload },
    { href: "/admin/content-enrichment", label: "Content Enrichment", icon: RefreshCw },
    { href: "/admin/journal-dates", label: "Journal Dates", icon: Calendar },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
    { href: "/admin/settings", label: "Settings", icon: Settings },
    { href: "/admin/users", label: "Users", icon: UserCog },
  ];
  
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{title} | HydrogenStudies Admin</title>
      </Helmet>
      
      <div className="flex min-h-screen flex-col">
        {/* Top navigation */}
        <header className="sticky top-0 z-40 border-b bg-background">
          <div className="container flex h-16 items-center justify-between px-4 md:px-6">
            <div className="flex items-center">
              <Link href="/" className="flex items-center mr-8">
                <span className="font-semibold tracking-tight text-xl">HydrogenStudies</span>
                <span className="bg-primary text-primary-foreground ml-2 rounded-sm px-1.5 py-0.5 text-xs font-medium">Admin</span>
              </Link>
              
              <nav className="hidden md:flex items-center space-x-4 lg:space-x-6">
                <Link href="/" className="flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                  <Home className="mr-2 h-4 w-4" />
                  View Site
                </Link>
              </nav>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <span className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full">
                  <span className="flex h-full w-full items-center justify-center bg-muted text-sm">A</span>
                </span>
                <div className="hidden md:block">
                  <p className="text-sm font-medium">Admin User</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <div className="flex-1 flex">
          {/* Sidebar */}
          <aside className="hidden md:flex w-64 flex-col border-r bg-background">
            <nav className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-2">
                {mainNavItems.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link 
                      href={href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                        location === href ? "bg-accent text-accent-foreground" : "transparent"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
          
          {/* Mobile navigation */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t bg-background">
            <nav className="flex h-16 items-center justify-around">
              {mainNavItems.slice(0, 5).map(({ href, label, icon: Icon }) => (
                <Link 
                  key={href} 
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 text-xs font-medium",
                    location === href ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </div>
          
          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
            <div className="container mx-auto max-w-6xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}