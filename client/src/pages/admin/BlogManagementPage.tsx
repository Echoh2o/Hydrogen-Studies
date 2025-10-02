import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminLayout from "@/components/admin/AdminLayout";
import { Loader2, FileText, Pencil, ListFilter, BarChart } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Import all the blog-related components
import BlogsPage from "./BlogsPage";

export default function BlogManagementPage() {
  const [activeTab, setActiveTab] = useState("manage");

  // Statistics query
  const statsQuery = useQuery({
    queryKey: ["/api/stats/dashboard"],
  });

  const stats = statsQuery.data || {
    totalBlogs: 0,
    draftBlogs: 0,
    publishedBlogs: 0,
  };

  // Define the tabs for our blog management page
  const blogTabs = [
    {
      id: "manage",
      label: "Manage Blogs",
      icon: <FileText className="h-4 w-4 mr-2" />,
      count: stats.totalBlogs,
    },
    {
      id: "create",
      label: "Create Blog",
      icon: <Pencil className="h-4 w-4 mr-2" />,
      count: null,
    },
    {
      id: "categories",
      label: "Blog Categories",
      icon: <ListFilter className="h-4 w-4 mr-2" />,
      count: null,
    },
    {
      id: "generator",
      label: "Blog Generator",
      icon: <FileText className="h-4 w-4 mr-2" />,
      count: null,
    },
    {
      id: "analytics",
      label: "Blog Analytics",
      icon: <BarChart className="h-4 w-4 mr-2" />,
      count: null,
    },
  ];

  return (
    <AdminLayout
      title="Blog Management"
      description="Create and manage blog content for hydrogen research"
    >
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Blog Management</h1>
        <p className="text-muted-foreground">
          Create, edit, and organize blog content for hydrogen research
        </p>
      </div>

      <Tabs
        defaultValue={activeTab}
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {blogTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="relative">
              <span className="flex items-center">
                {tab.icon}
                <span>{tab.label}</span>
              </span>

              {tab.count && tab.count > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground h-5 min-w-[20px] rounded-full text-xs flex items-center justify-center">
                  {tab.count > 99 ? "99+" : tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tabs content */}
        <TabsContent value="manage">
          {/* This is the blog management component */}
          <BlogsPage />
        </TabsContent>

        <TabsContent value="create">
          <div className="p-6 bg-muted/30 rounded-md border text-center">
            <h3 className="text-xl font-semibold mb-2">Blog Editor</h3>
            <p className="text-muted-foreground mb-4">
              This feature is currently under development.
            </p>

            <Alert>
              <AlertDescription>
                The blog creation tool will be available in the next update.
              </AlertDescription>
            </Alert>
          </div>
        </TabsContent>

        <TabsContent value="categories">
          <div className="p-6 bg-muted/30 rounded-md border text-center">
            <h3 className="text-xl font-semibold mb-2">Blog Categories</h3>
            <p className="text-muted-foreground mb-4">
              This feature is currently under development.
            </p>

            <Alert>
              <AlertDescription>
                The blog categories management tool will be available in the
                next update.
              </AlertDescription>
            </Alert>
          </div>
        </TabsContent>

        <TabsContent value="generator">
          <div className="p-6 bg-muted/30 rounded-md border text-center">
            <h3 className="text-xl font-semibold mb-2">Blog Generator</h3>
            <p className="text-muted-foreground mb-4">
              This feature is currently under development.
            </p>

            <Alert>
              <AlertDescription>
                The AI-powered blog generator will be available in the next
                update.
              </AlertDescription>
            </Alert>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="p-6 bg-muted/30 rounded-md border text-center">
            <h3 className="text-xl font-semibold mb-2">Blog Analytics</h3>
            <p className="text-muted-foreground mb-4">
              This feature is currently under development.
            </p>

            <Alert>
              <AlertDescription>
                The blog analytics dashboard will be available in the next
                update.
              </AlertDescription>
            </Alert>
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
