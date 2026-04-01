import { useState } from "react";
import { Helmet } from "react-helmet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  FileSpreadsheet,
  FileUp,
  Download,
  Table,
  FileJson,
  Database,
  UploadCloud,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function DataImportPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("excel");
  const [file, setFile] = useState<File | null>(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState<{
    total: number;
    imported: number;
    failed?: number;
    error?: string;
  } | null>(null);

  // Recent imports query
  const { data: recentImports, isLoading } = useQuery<any>({
    queryKey: ["/api/imports/recent"],
    retry: false,
    refetchInterval: false,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      setFile(selectedFiles[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to import",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setImportStats(null);

    const formData = new FormData();

    // Use the correct field name based on file type
    if (file.name.endsWith(".csv")) {
      formData.append("csvFile", file);
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      formData.append("file", file); // Default field name for Excel
    } else if (file.name.endsWith(".json")) {
      formData.append("jsonFile", file);
    } else {
      formData.append("file", file);
    }

    try {
      let endpoint = "/api/import/excel";

      // Determine file type and use appropriate endpoint
      if (file.name.endsWith(".csv")) {
        endpoint = "/api/import/csv";
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        endpoint = "/api/import/excel";
      } else if (file.name.endsWith(".json")) {
        endpoint = "/api/import/json";
      } else {
        throw new Error(
          "Unsupported file format. Please use .xlsx, .csv, or .json files.",
        );
      }

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Import failed: ${response.status} ${errorText || response.statusText}`,
        );
      }

      const data = await response.json();

      setImportStats({
        total: data.total || 0,
        imported: data.imported ?? data.success ?? 0,
        failed: data.failed || 0,
      });

      toast({
        title: "Import successful",
        description: `Imported ${data.imported ?? data.success ?? 0} of ${data.total || 0} studies.${data.failed ? ` ${data.failed} failed.` : ""}`,
      });
    } catch (error) {
      console.error("Import error:", error);
      setImportStats({
        total: 0,
        imported: 0,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });

      toast({
        title: "Import failed",
        description:
          error instanceof Error ? error.message : "Failed to import data",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleGoogleSheetImport = async () => {
    if (!googleSheetUrl) {
      toast({
        title: "No URL provided",
        description: "Please enter a Google Sheet URL",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setImportStats(null);

    try {
      const response = await fetch("/api/import/googlesheet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: googleSheetUrl }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Import failed: ${response.status} ${errorText || response.statusText}`,
        );
      }

      const data = await response.json();

      setImportStats({
        total: data.total || 0,
        imported: data.imported ?? data.success ?? 0,
        failed: data.failed || 0,
      });

      toast({
        title: "Import successful",
        description: `Imported ${data.imported ?? data.success ?? 0} of ${data.total || 0} studies.${data.failed ? ` ${data.failed} failed.` : ""}`,
      });
    } catch (error) {
      console.error("Google Sheet import error:", error);
      setImportStats({
        total: 0,
        imported: 0,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });

      toast({
        title: "Import failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to import data from Google Sheet",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    // In a real app, this would download a template file
    // For this example, we're just showing a toast
    toast({
      title: "Template downloaded",
      description: "Import template has been downloaded.",
    });
  };

  return (
    <AdminLayout
      title="Data Import"
      description="Import research data from various file formats"
    >
      <Helmet>
        <title>Data Import | HydrogenStudies Admin</title>
      </Helmet>

      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Data Import</h2>
          <p className="text-muted-foreground">
            Import hydrogen research studies from files and spreadsheets
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Importing data</AlertTitle>
          <AlertDescription>
            Use this tool to bulk import research data from Excel, CSV, Google
            Sheets, or JSON files. Make sure your data follows the expected
            format or use the template.
          </AlertDescription>
        </Alert>

        <Tabs
          defaultValue="excel"
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:w-auto">
            <TabsTrigger value="excel" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span>Excel/CSV</span>
            </TabsTrigger>
            <TabsTrigger value="google" className="flex items-center gap-2">
              <Table className="h-4 w-4" />
              <span>Google Sheets</span>
            </TabsTrigger>
            <TabsTrigger value="json" className="flex items-center gap-2">
              <FileJson className="h-4 w-4" />
              <span>JSON</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span>Export</span>
            </TabsTrigger>
          </TabsList>

          <Card>
            <CardHeader>
              <CardTitle>
                {activeTab === "excel" && "Import from Excel or CSV"}
                {activeTab === "google" && "Import from Google Sheets"}
                {activeTab === "json" && "Import from JSON"}
                {activeTab === "export" && "Export Data"}
              </CardTitle>
              <CardDescription>
                {activeTab === "excel" &&
                  "Upload Excel (.xlsx) or CSV files containing research data"}
                {activeTab === "google" &&
                  "Import data directly from a published Google Sheet"}
                {activeTab === "json" &&
                  "Upload JSON files with research study data"}
                {activeTab === "export" &&
                  "Export your research database in various formats"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TabsContent value="excel" className="mt-0">
                <div className="space-y-4">
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="excel-file">Upload Excel or CSV File</Label>
                    <Input
                      id="excel-file"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      disabled={importing}
                    />
                    <p className="text-xs text-muted-foreground">
                      Accepted formats: .xlsx, .xls, .csv
                    </p>
                  </div>

                  <div className="flex items-center space-x-4">
                    <Button
                      onClick={handleUpload}
                      disabled={!file || importing}
                      className="flex items-center space-x-2"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : (
                        <>
                          <FileUp className="h-4 w-4" />
                          <span>Upload and Import</span>
                        </>
                      )}
                    </Button>

                    <Button variant="outline" onClick={downloadTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </Button>
                  </div>

                  {importStats && (
                    <Alert
                      variant={importStats.error ? "destructive" : "default"}
                    >
                      {importStats.error ? (
                        <>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Import Failed</AlertTitle>
                          <AlertDescription>
                            {importStats.error}
                          </AlertDescription>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <AlertTitle>Import Successful</AlertTitle>
                          <AlertDescription>
                            Imported {importStats.imported} of{" "}
                            {importStats.total} studies.{importStats.failed ? ` ${importStats.failed} failed.` : ""}
                          </AlertDescription>
                        </>
                      )}
                    </Alert>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="google" className="mt-0">
                <div className="space-y-4">
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="google-sheet-url">Google Sheet URL</Label>
                    <Input
                      id="google-sheet-url"
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                      disabled={importing}
                    />
                    <p className="text-xs text-muted-foreground">
                      The Google Sheet must be published to the web and
                      accessible to anyone with the link
                    </p>
                  </div>

                  <div className="flex items-center space-x-4">
                    <Button
                      onClick={handleGoogleSheetImport}
                      disabled={!googleSheetUrl || importing}
                      className="flex items-center space-x-2"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="h-4 w-4" />
                          <span>Import from Google Sheets</span>
                        </>
                      )}
                    </Button>

                    <Button variant="outline" onClick={downloadTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </Button>
                  </div>

                  {importStats && (
                    <Alert
                      variant={importStats.error ? "destructive" : "default"}
                    >
                      {importStats.error ? (
                        <>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Import Failed</AlertTitle>
                          <AlertDescription>
                            {importStats.error}
                          </AlertDescription>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <AlertTitle>Import Successful</AlertTitle>
                          <AlertDescription>
                            Imported {importStats.imported} of{" "}
                            {importStats.total} studies.{importStats.failed ? ` ${importStats.failed} failed.` : ""}
                          </AlertDescription>
                        </>
                      )}
                    </Alert>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="json" className="mt-0">
                <div className="space-y-4">
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="json-file">Upload JSON File</Label>
                    <Input
                      id="json-file"
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      disabled={importing}
                    />
                    <p className="text-xs text-muted-foreground">
                      JSON file should contain an array of study objects
                    </p>
                  </div>

                  <div className="flex items-center space-x-4">
                    <Button
                      onClick={handleUpload}
                      disabled={!file || importing}
                      className="flex items-center space-x-2"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : (
                        <>
                          <FileUp className="h-4 w-4" />
                          <span>Upload and Import</span>
                        </>
                      )}
                    </Button>

                    <Button variant="outline" onClick={downloadTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Schema
                    </Button>
                  </div>

                  {importStats && (
                    <Alert
                      variant={importStats.error ? "destructive" : "default"}
                    >
                      {importStats.error ? (
                        <>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Import Failed</AlertTitle>
                          <AlertDescription>
                            {importStats.error}
                          </AlertDescription>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <AlertTitle>Import Successful</AlertTitle>
                          <AlertDescription>
                            Imported {importStats.imported} of{" "}
                            {importStats.total} studies.{importStats.failed ? ` ${importStats.failed} failed.` : ""}
                          </AlertDescription>
                        </>
                      )}
                    </Alert>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="export" className="mt-0">
                <div className="space-y-4">
                  <p className="text-sm">
                    Export your research database to use elsewhere or create
                    backups.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="flex items-center space-x-2 justify-start h-auto py-4"
                    >
                      <FileSpreadsheet className="h-5 w-5" />
                      <div className="flex flex-col items-start">
                        <span>Export to Excel</span>
                        <span className="text-xs text-muted-foreground">
                          Download as .xlsx file
                        </span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="flex items-center space-x-2 justify-start h-auto py-4"
                    >
                      <FileUp className="h-5 w-5" />
                      <div className="flex flex-col items-start">
                        <span>Export to CSV</span>
                        <span className="text-xs text-muted-foreground">
                          Download as .csv file
                        </span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="flex items-center space-x-2 justify-start h-auto py-4"
                    >
                      <FileJson className="h-5 w-5" />
                      <div className="flex flex-col items-start">
                        <span>Export to JSON</span>
                        <span className="text-xs text-muted-foreground">
                          Download as .json file
                        </span>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="flex items-center space-x-2 justify-start h-auto py-4"
                    >
                      <Database className="h-5 w-5" />
                      <div className="flex flex-col items-start">
                        <span>Full Database Backup</span>
                        <span className="text-xs text-muted-foreground">
                          Complete database export
                        </span>
                      </div>
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Recent Imports</CardTitle>
            <CardDescription>History of recent data imports</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !recentImports || recentImports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium">No recent imports</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Import data to see history here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">File</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Studies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Placeholder for recent imports - in reality, this would map over recentImports */}
                    <tr className="border-b">
                      <td className="py-3 text-sm">May 14, 2024</td>
                      <td className="py-3 text-sm">hydrogen_studies.xlsx</td>
                      <td className="py-3 text-sm">Excel</td>
                      <td className="py-3 text-sm">
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Success
                        </span>
                      </td>
                      <td className="py-3 text-sm text-right">42</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 text-sm">May 12, 2024</td>
                      <td className="py-3 text-sm">pubmed_export.csv</td>
                      <td className="py-3 text-sm">CSV</td>
                      <td className="py-3 text-sm">
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Success
                        </span>
                      </td>
                      <td className="py-3 text-sm text-right">18</td>
                    </tr>
                    <tr>
                      <td className="py-3 text-sm">May 10, 2024</td>
                      <td className="py-3 text-sm">research_data.json</td>
                      <td className="py-3 text-sm">JSON</td>
                      <td className="py-3 text-sm">
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                          <AlertCircle className="mr-1 h-3 w-3" /> Failed
                        </span>
                      </td>
                      <td className="py-3 text-sm text-right">0</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
