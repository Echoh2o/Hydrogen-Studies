import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  Loader2,
  Database,
  Search,
  Calendar,
  RefreshCw,
  Image,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Import all the necessary study-related components
import KeywordMonitorPage from "./KeywordMonitorPage";
import BatchEnrichmentPage from "./BatchEnrichmentPage";
import ContentEnrichmentPage from "./ContentEnrichmentPage";
import ResearchImportPage from "./ResearchImportPage";
import ImageGenerationPage from "./ImageGenerationPage";
import StudiesTable from "./StudiesTable";

export default function StudiesManagementPage() {
  const [activeTab, setActiveTab] = useState("manage");

  // Statistics query
  const statsQuery = useQuery<any>({
    queryKey: ["/api/stats/dashboard"],
  });

  const stats = statsQuery.data || {
    totalStudies: 0,
    studiesNeedingEnrichment: 0,
    pendingKeywordResults: 0,
  };

  // Define the tabs for our studies management page
  const studyTabs = [
    {
      id: "manage",
      label: "Manage Studies",
      icon: <Database className="h-4 w-4 mr-2" />,
      count: stats.totalStudies,
    },
    {
      id: "import",
      label: "Find Studies",
      icon: <Search className="h-4 w-4 mr-2" />,
      count: null,
    },
    {
      id: "monitor",
      label: "Monitor Keywords",
      icon: <Calendar className="h-4 w-4 mr-2" />,
      count: stats.pendingKeywordResults,
    },
    {
      id: "enrichment",
      label: "Content Enrichment",
      icon: <RefreshCw className="h-4 w-4 mr-2" />,
      count: stats.studiesNeedingEnrichment,
    },
    {
      id: "batch",
      label: "Batch Enrichment",
      icon: <RefreshCw className="h-4 w-4 mr-2" />,
      count: null,
    },
    {
      id: "images",
      label: "Generate Images",
      icon: <Image className="h-4 w-4 mr-2" />,
      count: null,
    },
  ];

  return (
    <AdminLayout
      title="Studies Management"
      description="Manage all aspects of hydrogen research studies"
    >
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Studies Management</h1>
        <p className="text-muted-foreground">
          Manage, import, enrich, and monitor studies all in one place
        </p>
      </div>

      <Tabs
        defaultValue={activeTab}
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {studyTabs.map((tab) => (
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
          {/* This is the studies management component */}
          <StudiesTable />
        </TabsContent>

        <TabsContent value="import">
          <ResearchImportPage embedded />
        </TabsContent>

        <TabsContent value="monitor">
          <KeywordMonitorPage embedded />
        </TabsContent>

        <TabsContent value="enrichment">
          <ContentEnrichmentPage embedded />
        </TabsContent>

        <TabsContent value="batch">
          <BatchEnrichmentPage embedded />
        </TabsContent>

        <TabsContent value="images">
          <ImageGenerationPage embedded />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
