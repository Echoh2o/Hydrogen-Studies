import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    setImportResult(null);
  };

  const handleImport = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select an Excel file to import",
        variant: "destructive",
      });
      return;
    }

    // Check file type
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast({
        title: "Invalid file format",
        description: "Please select an Excel file (.xlsx or .xls)",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsImporting(true);
      setImportResult(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await apiRequest("/api/import/excel", {
        method: "POST",
        body: formData,
        headers: {
          // Do not set Content-Type for multipart/form-data
        },
      });

      setImportResult(response);

      toast({
        title: "Import completed",
        description: `Successfully imported ${response.imported} studies out of ${response.total}`,
        variant: "default",
      });
    } catch (error: any) {
      console.error("Import error:", error);

      toast({
        title: "Import failed",
        description:
          error.message || "Failed to import studies from Excel file",
        variant: "destructive",
      });

      setImportResult({
        success: false,
        error: error.message,
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Import Hydrogen Research Database</CardTitle>
        <CardDescription>
          Import studies from an Excel spreadsheet. The file should contain
          columns that match our database structure.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleImport} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="file">Excel File</Label>
            <Input
              id="file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={isImporting}
            />
            <p className="text-sm text-gray-500">
              Supported file types: .xlsx, .xls
            </p>
          </div>

          {file && (
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4" />
              <span>{file.name}</span>
              <span className="text-gray-500">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          )}

          {importResult && (
            <Alert
              variant={importResult.imported > 0 ? "default" : "destructive"}
            >
              {importResult.imported > 0 ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {importResult.imported > 0
                  ? "Import Successful"
                  : "Import Failed"}
              </AlertTitle>
              <AlertDescription>
                {importResult.imported > 0 ? (
                  <div className="space-y-1">
                    <p>
                      Successfully imported {importResult.imported} out of{" "}
                      {importResult.total} studies.
                    </p>
                    {importResult.failed > 0 && (
                      <p>Failed to import {importResult.failed} studies.</p>
                    )}
                    {importResult.errors && importResult.errors.length > 0 && (
                      <details>
                        <summary className="cursor-pointer font-medium">
                          View errors
                        </summary>
                        <ul className="mt-2 list-disc pl-5 space-y-1">
                          {importResult.errors.map(
                            (error: string, index: number) => (
                              <li key={index} className="text-xs">
                                {error}
                              </li>
                            ),
                          )}
                        </ul>
                      </details>
                    )}
                  </div>
                ) : (
                  <p>
                    {importResult.message ||
                      "Failed to import studies from Excel file"}
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>

      <CardFooter>
        <Button
          type="submit"
          onClick={handleImport}
          disabled={!file || isImporting}
          className="w-full"
        >
          {isImporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            "Import Studies"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
