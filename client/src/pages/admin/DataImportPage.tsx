import { useState, useRef } from "react";
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
import { Progress } from "@/components/ui/progress";

type ImportPhase = "idle" | "uploading" | "processing" | "done" | "error";

interface ImportStats {
  total: number;
  imported: number;
  failed?: number;
  error?: string;
}

export default function DataImportPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("excel");
  const [file, setFile] = useState<File | null>(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const importing = phase === "uploading" || phase === "processing";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      setFile(selectedFiles[0]);
      setImportStats(null);
      setPhase("idle");
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

    setImportStats(null);
    setUploadProgress(0);
    setPhase("uploading");

    const formData = new FormData();
    let endpoint: string;

    // Determine endpoint and field name based on file type
    if (file.name.endsWith(".csv")) {
      formData.append("csvFile", file);
      endpoint = "/api/import/csv";
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      formData.append("file", file);
      endpoint = "/api/import/excel";
    } else {
      setPhase("error");
      setImportStats({
        total: 0,
        imported: 0,
        error: "Unsupported file format. Please use .xlsx, .xls, or .csv files.",
      });
      toast({
        title: "Unsupported format",
        description: "Please use .xlsx, .xls, or .csv files.",
        variant: "destructive",
      });
      return;
    }

    // Use XMLHttpRequest for upload progress tracking
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.upload.addEventListener("load", () => {
      // Upload finished, now server is processing
      setUploadProgress(100);
      setPhase("processing");
    });

    const result = await new Promise<{ ok: boolean; data?: any; error?: string }>((resolve) => {
      xhr.addEventListener("load", () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ ok: true, data });
          } else {
            resolve({ ok: false, error: data.message || data.error || `Server error ${xhr.status}` });
          }
        } catch {
          resolve({ ok: false, error: `Server error ${xhr.status}: ${xhr.statusText}` });
        }
      });

      xhr.addEventListener("error", () => {
        resolve({ ok: false, error: "Network error — could not reach the server" });
      });

      xhr.addEventListener("abort", () => {
        resolve({ ok: false, error: "Upload cancelled" });
      });

      xhr.open("POST", endpoint);
      xhr.withCredentials = true; // Send session cookie for requireAdmin auth
      xhr.send(formData);
    });

    xhrRef.current = null;

    if (result.ok && result.data) {
      const data = result.data;
      setPhase("done");
      setImportStats({
        total: data.total || 0,
        imported: data.imported ?? 0,
        failed: data.failed || 0,
      });
      toast({
        title: "Import successful",
        description: `Imported ${data.imported ?? 0} of ${data.total || 0} studies.${data.failed ? ` ${data.failed} failed.` : ""}`,
      });
    } else {
      setPhase("error");
      setImportStats({
        total: 0,
        imported: 0,
        error: result.error || "Unknown error occurred",
      });
      toast({
        title: "Import failed",
        description: result.error || "Failed to import data",
        variant: "destructive",
      });
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

    setPhase("processing");
    setImportStats(null);

    try {
      const response = await fetch("/api/import/googlesheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: googleSheetUrl }),
        credentials: "include", // Send session cookie for requireAdmin auth
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message || errorData?.error || `Import failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      setPhase("done");
      setImportStats({
        total: data.total || 0,
        imported: data.imported ?? 0,
        failed: data.failed || 0,
      });

      toast({
        title: "Import successful",
        description: `Imported ${data.imported ?? 0} of ${data.total || 0} studies.${data.failed ? ` ${data.failed} failed.` : ""}`,
      });
    } catch (error) {
      console.error("Google Sheet import error:", error);
      setPhase("error");
      setImportStats({
        total: 0,
        imported: 0,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });

      toast({
        title: "Import failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to import data from Google Sheet",
        variant: "destructive",
      });
    }
  };

  const downloadTemplate = () => {
    toast({
      title: "Template downloaded",
      description: "Import template has been downloaded.",
    });
  };

  // Shared progress + result display component
  const ImportProgress = () => {
    if (phase === "idle") return null;

    return (
      <div className="space-y-3">
        {/* Upload progress bar */}
        {phase === "uploading" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Uploading file... {uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* Processing indicator */}
        {phase === "processing" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing studies — this may take a moment for large files...</span>
            </div>
            <Progress value={100} className="h-2 animate-pulse" />
          </div>
        )}

        {/* Result alert */}
        {importStats && (phase === "done" || phase === "error") && (
          <Alert variant={importStats.error ? "destructive" : "default"}>
            {importStats.error ? (
              <>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Import Failed</AlertTitle>
                <AlertDescription>{importStats.error}</AlertDescription>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Import Complete</AlertTitle>
                <AlertDescription>
                  Imported {importStats.imported} of {importStats.total} studies.
                  {importStats.failed ? ` ${importStats.failed} failed.` : ""}
                </AlertDescription>
              </>
            )}
          </Alert>
        )}
      </div>
    );
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
            Use this tool to bulk import research data from Excel, CSV, or Google
            Sheets. Make sure your data follows the expected format or use the
            template.
          </AlertDescription>
        </Alert>

        <Tabs
          defaultValue="excel"
          value={activeTab}
          onValueChange={(tab) => {
            setActiveTab(tab);
            // Reset state when switching tabs
            setPhase("idle");
            setImportStats(null);
          }}
          className="space-y-4"
        >
          <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:w-auto">
            <TabsTrigger value="excel" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span>Excel/CSV</span>
            </TabsTrigger>
            <TabsTrigger value="google" className="flex items-center gap-2">
              <Table className="h-4 w-4" />
              <span>Google Sheets</span>
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
                {activeTab === "export" && "Export Data"}
              </CardTitle>
              <CardDescription>
                {activeTab === "excel" &&
                  "Upload Excel (.xlsx) or CSV files containing research data"}
                {activeTab === "google" &&
                  "Import data directly from a published Google Sheet"}
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
                      Accepted formats: .xlsx, .xls, .csv (max 10 MB)
                    </p>
                  </div>

                  {file && phase === "idle" && (
                    <div className="text-sm text-muted-foreground">
                      Selected: <span className="font-medium text-foreground">{file.name}</span>{" "}
                      ({(file.size / 1024).toFixed(0)} KB)
                    </div>
                  )}

                  <div className="flex items-center space-x-4">
                    <Button
                      onClick={handleUpload}
                      disabled={!file || importing}
                      className="flex items-center space-x-2"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>
                            {phase === "uploading" ? "Uploading..." : "Processing..."}
                          </span>
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

                  <ImportProgress />
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

                  <ImportProgress />
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
      </div>
    </AdminLayout>
  );
}
