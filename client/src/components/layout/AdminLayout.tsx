import React, { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Database,
  BarChart2,
  Image,
  Layers,
  FileText,
  BookOpen,
  Search,
  Upload,
  Settings,
  Tag,
  Calendar,
  RefreshCcw,
  Home,
  Folders,
  KeyRound,
  FolderTree,
} from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [location] = useLocation();

  const isActive = (path: string) => {
    return location === path || location.startsWith(`${path}/`);
  };

  const menu = [
    {
      name: "Dashboard",
      path: "/admin",
      icon: <Home className="h-5 w-5" />,
    },
    {
      name: "Studies Management",
      path: "/admin/studies",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      name: "Blogs Management",
      path: "/admin/blogs",
      icon: <BookOpen className="h-5 w-5" />,
    },
    {
      name: "Data Import",
      path: "/admin/data-import",
      icon: <Upload className="h-5 w-5" />,
    },
    { divider: true },
    {
      name: "Research Database",
      path: "/admin/research-database",
      icon: <Database className="h-5 w-5" />,
    },
    {
      name: "Content Enrichment",
      path: "/admin/content-enrichment",
      icon: <Layers className="h-5 w-5" />,
    },
    {
      name: "Batch Enrichment",
      path: "/admin/batch-enrichment",
      icon: <RefreshCcw className="h-5 w-5" />,
    },
    {
      name: "Batch Categorization",
      path: "/admin/batch-categorization",
      icon: <FolderTree className="h-5 w-5" />,
    },
    {
      name: "Image Generation",
      path: "/admin/image-generation",
      icon: <Image className="h-5 w-5" />,
    },
    {
      name: "Keyword Monitor",
      path: "/admin/keyword-monitor",
      icon: <KeyRound className="h-5 w-5" />,
    },
    { divider: true },
    {
      name: "Analytics",
      path: "/admin/analytics",
      icon: <BarChart2 className="h-5 w-5" />,
    },
    {
      name: "Journal Dates",
      path: "/admin/journal-dates",
      icon: <Calendar className="h-5 w-5" />,
    },
    {
      name: "Categories",
      path: "/admin/categories",
      icon: <Tag className="h-5 w-5" />,
    },
    {
      name: "Settings",
      path: "/admin/settings",
      icon: <Settings className="h-5 w-5" />,
    },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold">Hydrogen Admin</h1>
        </div>
        <nav className="p-4">
          <ul className="space-y-1">
            {menu.map((item, i) =>
              item.divider ? (
                <li
                  key={`divider-${i}`}
                  className="my-4 border-t border-gray-200"
                ></li>
              ) : (
                <li key={item.path}>
                  <Link href={item.path}>
                    <a
                      className={cn(
                        "flex items-center px-4 py-2.5 text-sm font-medium rounded-lg",
                        isActive(item.path)
                          ? "bg-primary text-primary-foreground"
                          : "text-gray-700 hover:bg-gray-100",
                      )}
                    >
                      <span className="mr-3 text-sm">{item.icon}</span>
                      {item.name}
                    </a>
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1">
        <div className="flex items-center justify-between p-6 border-b bg-white">
          <h1 className="text-xl font-semibold">Administration</h1>
          <div className="flex items-center space-x-4">
            <Link href="/">
              <a className="text-sm text-gray-600 hover:text-gray-900">
                View Site
              </a>
            </Link>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
