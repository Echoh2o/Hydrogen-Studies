import { useState, useRef } from "react";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  FileSpreadsheet,
  FileUp,
  Download,
  Table,
  Database,
  UploadCloud,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
  ExternalLink,
  Ban,
  Copy,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

type ImportPhase = "idle" | "uploading" | "analyzing" | "previewing" | "importing" | "done" | "error";

interface AnalysisResult {
  totalRows: number;
  readyToImport: number;
  duplicatesByDoi: number;
  duplicatesByTitle: number;
  batchDuplicates: number;
  previouslyDeleted: number;
  emptyTitles: number;
  sampleStudies?: { title: string; doi: string | null; category: string; status: string; existingId?: number }[];
}

interface ImportStats {
  total: number;
  imported: number;
  failed?: number;
  skippedDuplicate?: number;
  skippedDeleted?: number;
  importedStudyIds?: number[];
  skippedStudies?: { title: string; deletedBy: string | null }[];
  duplicateStudies?: { title: string; reason: string; existingId?: number }[];
  error?: string;
}

interface StreamProgress {
  processed: number;
  total: number;
  imported: number;
}

export default function DataImportPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("excel");
  const [file, setFile] = useState<File | null>(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [streamProgress, setStreamProgress] = useState<StreamProgress | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const busy = phase === "uploading" || phase === "analyzing" || phase === "importing";

  const resetState = () => {
    setPhase("idle");
    setAnalysis(null);
    setImportStats(null);
    setStreamProgress(null);
    setUploadProgress(0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      setFile(selectedFiles[0]);
      resetState();
    }
  };

  // Step 1: Analyze file (dry run)
  const handleAnalyze = async () => {
    if (!file) return;

    resetState();
    setPhase("uploading");

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.upload.addEventListener("load", () => {
      setUploadProgress(100);
      setPhase("analyzing");
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
      xhr.addEventListener("error", () => resolve({ ok: false, error: "Network error" }));
      xhr.addEventListener("abort", () => resolve({ ok: false, error: "Cancelled" }));

      xhr.open("POST", "/api/import/analyze");
      xhr.withCredentials = true;
      xhr.send(formData);
    });

    xhrRef.current = null;

    if (result.ok && result.data) {
      setAnalysis(result.data);
      setPhase("previewing");
    } else {
      setPhase("error");
      setImportStats({ total: 0, imported: 0, error: result.error });
      toast({ title: "Analysis failed", description: result.error, variant: "destructive" });
    }
  };

  // Step 2: Confirm import with SSE streaming
  const handleConfirmImport = async () => {
    if (!file) return;

    setPhase("importing");
    setStreamProgress(null);
    setImportStats(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/import/excel/stream", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || `Server error ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "progress") {
              setStreamProgress({ processed: event.processed, total: event.total, imported: event.imported });
            } else if (event.type === "complete") {
              setPhase("done");
              setStreamProgress(null);
              setImportStats({
                total: event.total || 0,
                imported: event.imported || 0,
                failed: event.failed || 0,
                skippedDuplicate: event.skippedDuplicate || 0,
                skippedDeleted: event.skippedDeleted || 0,
                importedStudyIds: event.importedStudyIds,
                skippedStudies: event.skippedStudies,
                duplicateStudies: event.duplicateStudies,
              });
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch (parseErr) {
            // Skip malformed SSE lines
          }
        }
      }

      if (phase !== "done") setPhase("done");
    } catch (error) {
      setPhase("error");
      const msg = error instanceof Error ? error.message : "Import failed";
      setImportStats({ total: 0, imported: 0, error: msg });
      toast({ title: "Import failed", description: msg, variant: "destructive" });
    }
  };

  const handleGoogleSheetImport = async () => {
    if (!googleSheetUrl) return;

    setPhase("importing");
    setImportStats(null);

    try {
      const response = await fetch("/api/import/googlesheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: googleSheetUrl }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || errorData?.error || `Import failed: ${response.status}`);
      }

      const data = await response.json();

      setPhase("done");
      setImportStats({
        total: data.total || 0,
        imported: data.imported ?? 0,
        failed: data.failed || 0,
        skippedDuplicate: data.skippedDuplicate || 0,
        skippedDeleted: data.skippedDeleted || 0,
        importedStudyIds: data.importedStudyIds,
        skippedStudies: data.skippedStudies,
        duplicateStudies: data.duplicateStudies,
      });
    } catch (error) {
      setPhase("error");
      setImportStats({
        total: 0,
        imported: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import",
        variant: "destructive",
      });
    }
  };

  // Analysis preview card
  const AnalysisPreview = () => {
    if (!analysis) return null;

    return (
      <div className="space-y-4">
        <Alert>
          <Search className="h-4 w-4" />
          <AlertTitle>File Analysis Complete</AlertTitle>
          <AlertDescription>
            Review the breakdown below, then click "Confirm Import" to proceed.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-md border p-3 text-center">
            <p className="text-2xl font-bold">{analysis.totalRows}</p>
            <p className="text-xs text-muted-foreground">Total Rows</p>
          </div>
          <div className="rounded-md border p-3 text-center border-green-200 bg-green-50 dark:bg-green-950/20">
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{analysis.readyToImport}</p>
            <p className="text-xs text-muted-foreground">Ready to Import</p>
          </div>
          <div className="rounded-md border p-3 text-center border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
              {analysis.duplicatesByDoi + analysis.duplicatesByTitle + analysis.batchDuplicates}
            </p>
            <p className="text-xs text-muted-foreground">Duplicates (skip)</p>
          </div>
          <div className="rounded-md border p-3 text-center border-red-200 bg-red-50 dark:bg-red-950/20">
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">{analysis.previouslyDeleted}</p>
            <p className="text-xs text-muted-foreground">Deleted (skip)</p>
          </div>
        </div>

        {(analysis.duplicatesByDoi > 0 || analysis.duplicatesByTitle > 0 || analysis.batchDuplicates > 0) && (
          <div className="text-xs text-muted-foreground space-x-3">
            {analysis.duplicatesByDoi > 0 && (
              <span><Copy className="inline h-3 w-3 mr-1" />{analysis.duplicatesByDoi} by DOI</span>
            )}
            {analysis.duplicatesByTitle > 0 && (
              <span><Copy className="inline h-3 w-3 mr-1" />{analysis.duplicatesByTitle} by title</span>
            )}
            {analysis.batchDuplicates > 0 && (
              <span><Copy className="inline h-3 w-3 mr-1" />{analysis.batchDuplicates} within file</span>
            )}
            {analysis.emptyTitles > 0 && (
              <span><Ban className="inline h-3 w-3 mr-1" />{analysis.emptyTitles} empty titles</span>
            )}
          </div>
        )}

        {/* Sample preview table */}
        {analysis.sampleStudies && analysis.sampleStudies.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Preview first {analysis.sampleStudies.length} rows
            </summary>
            <div className="mt-2 max-h-60 overflow-y-auto border rounded-md">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left p-2">Title</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.sampleStudies.map((s, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 truncate max-w-[300px]">{s.title}</td>
                      <td className="p-2">
                        <Badge
                          variant={s.status === "new" ? "default" : "secondary"}
                          className={
                            s.status === "new" ? "bg-green-100 text-green-800" :
                            s.status.includes("duplicate") ? "bg-yellow-100 text-yellow-800" :
                            s.status === "deleted" ? "bg-red-100 text-red-800" :
                            ""
                          }
                        >
                          {s.status === "new" ? "New" :
                           s.status === "duplicate_doi" ? "Dup (DOI)" :
                           s.status === "duplicate_title" ? "Dup (Title)" :
                           s.status === "batch_duplicate" ? "Dup (Batch)" :
                           s.status === "deleted" ? "Deleted" :
                           s.status === "empty" ? "Empty" : s.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={handleConfirmImport} disabled={analysis.readyToImport === 0}>
            <FileUp className="h-4 w-4 mr-2" />
            Confirm Import ({analysis.readyToImport} studies)
          </Button>
          <Button variant="outline" onClick={resetState}>
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  // Progress + results display
  const ImportProgress = () => {
    if (phase === "idle" || phase === "previewing") return null;

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

        {/* Analyzing indicator */}
        {phase === "analyzing" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing file for duplicates and conflicts...</span>
            </div>
            <Progress value={100} className="h-2 animate-pulse" />
          </div>
        )}

        {/* Import progress with row counts */}
        {phase === "importing" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {streamProgress ? (
                <span>
                  Importing... {streamProgress.processed} / {streamProgress.total} rows
                  ({streamProgress.imported} imported)
                </span>
              ) : (
                <span>Starting import...</span>
              )}
            </div>
            <Progress
              value={streamProgress ? (streamProgress.processed / streamProgress.total) * 100 : 0}
              className="h-2"
            />
          </div>
        )}

        {/* Results */}
        {importStats && (phase === "done" || phase === "error") && (
          <>
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
                    <span className="font-medium">{importStats.imported}</span> of {importStats.total} studies imported.
                    {importStats.skippedDuplicate ? ` ${importStats.skippedDuplicate} duplicates skipped.` : ""}
                    {importStats.skippedDeleted ? ` ${importStats.skippedDeleted} previously deleted skipped.` : ""}
                    {importStats.failed ? ` ${importStats.failed} failed.` : ""}
                  </AlertDescription>
                </>
              )}
            </Alert>

            {/* Post-import navigation */}
            {!importStats.error && importStats.imported > 0 && (
              <div className="flex items-center gap-3">
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/studies">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View All Studies
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setFile(null); resetState(); }}>
                  Import More
                </Button>
              </div>
            )}

            {/* Duplicate details */}
            {importStats.duplicateStudies && importStats.duplicateStudies.length > 0 && (
              <Alert>
                <Copy className="h-4 w-4" />
                <AlertTitle>Duplicate Studies Skipped ({importStats.duplicateStudies.length})</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5 space-y-1 text-xs mt-2 max-h-40 overflow-y-auto">
                    {importStats.duplicateStudies.map((s, i) => (
                      <li key={i}>
                        {s.title}
                        <span className="text-muted-foreground"> — {s.reason}</span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Previously deleted details */}
            {importStats.skippedStudies && importStats.skippedStudies.length > 0 && (
              <Alert>
                <Trash2 className="h-4 w-4" />
                <AlertTitle>Previously Deleted Studies Skipped ({importStats.skippedStudies.length})</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5 space-y-1 text-xs mt-2 max-h-40 overflow-y-auto">
                    {importStats.skippedStudies.map((s, i) => (
                      <li key={i}>
                        {s.title}
                        {s.deletedBy && <span className="text-muted-foreground"> — deleted by {s.deletedBy}</span>}
                      </li>
                    ))}
                  </ul>
                  <Link href="/admin/deletion-ledger" className="text-xs underline mt-2 inline-block">
                    Manage deletion ledger
                  </Link>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <AdminLayout title="Data Import" description="Import research data from various file formats">
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

        <Tabs
          defaultValue="excel"
          value={activeTab}
          onValueChange={(tab) => {
            setActiveTab(tab);
            resetState();
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
                {activeTab === "excel" && "Upload a file to analyze, then review and confirm the import"}
                {activeTab === "google" && "Import data directly from a published Google Sheet"}
                {activeTab === "export" && "Export your research database in various formats"}
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
                      disabled={busy}
                    />
                    <p className="text-xs text-muted-foreground">
                      Accepted formats: .xlsx, .xls, .csv (max 10 MB)
                    </p>
                  </div>

                  {file && phase === "idle" && (
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground">
                        Selected: <span className="font-medium text-foreground">{file.name}</span>{" "}
                        ({(file.size / 1024).toFixed(0)} KB)
                      </div>
                      <Button onClick={handleAnalyze} className="flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        Analyze File
                      </Button>
                    </div>
                  )}

                  {/* Step 1 result: Analysis preview */}
                  {phase === "previewing" && <AnalysisPreview />}

                  {/* Progress / results for all other phases */}
                  {phase !== "idle" && phase !== "previewing" && <ImportProgress />}
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
                      disabled={busy}
                    />
                    <p className="text-xs text-muted-foreground">
                      The Google Sheet must be published to the web and accessible to anyone with the link
                    </p>
                  </div>

                  <Button
                    onClick={handleGoogleSheetImport}
                    disabled={!googleSheetUrl || busy}
                    className="flex items-center gap-2"
                  >
                    {busy ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Importing...</>
                    ) : (
                      <><UploadCloud className="h-4 w-4" /> Import from Google Sheets</>
                    )}
                  </Button>

                  <ImportProgress />
                </div>
              </TabsContent>

              <TabsContent value="export" className="mt-0">
                <div className="space-y-4">
                  <p className="text-sm">Export your research database to use elsewhere or create backups.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button variant="outline" className="flex items-center space-x-2 justify-start h-auto py-4">
                      <FileSpreadsheet className="h-5 w-5" />
                      <div className="flex flex-col items-start">
                        <span>Export to Excel</span>
                        <span className="text-xs text-muted-foreground">Download as .xlsx file</span>
                      </div>
                    </Button>
                    <Button variant="outline" className="flex items-center space-x-2 justify-start h-auto py-4">
                      <FileUp className="h-5 w-5" />
                      <div className="flex flex-col items-start">
                        <span>Export to CSV</span>
                        <span className="text-xs text-muted-foreground">Download as .csv file</span>
                      </div>
                    </Button>
                    <Button variant="outline" className="flex items-center space-x-2 justify-start h-auto py-4">
                      <Database className="h-5 w-5" />
                      <div className="flex flex-col items-start">
                        <span>Full Database Backup</span>
                        <span className="text-xs text-muted-foreground">Complete database export</span>
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
