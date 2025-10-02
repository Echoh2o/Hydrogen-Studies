import React, { useState, useRef } from "react";
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
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  Upload,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import type { ImportResponse } from "@/types/import";
import FieldMappingDialog from "./FieldMappingDialog";

// Database fields and their user-friendly names
const dbFields = [
  { value: "title", label: "Title" },
  { value: "abstract", label: "Abstract" },
  { value: "year", label: "Year" },
  { value: "journal", label: "Journal" },
  { value: "url", label: "URL/DOI/PMID" },
  { value: "type", label: "Study Type" },
  { value: "methods", label: "Methods" },
  { value: "model", label: "Model" },
  { value: "country", label: "Country" },
  { value: "authors", label: "Authors" },
  { value: "peerReviewed", label: "Peer Reviewed" },
  { value: "categoryId", label: "Category ID" },
  { value: "first_author", label: "First Author" },
  { value: "other_authors", label: "Other Authors" },
  { value: "last_author", label: "Last Author" },
  { value: "primary_topic", label: "Primary Topic" },
  { value: "secondary_topic", label: "Secondary Topic" },
  { value: "tertiary_topic", label: "Tertiary Topic" },
  { value: "vehicle", label: "Vehicle" },
  { value: "ph", label: "pH" },
  { value: "application", label: "Application" },
  { value: "comparison", label: "Comparison" },
  { value: "complement", label: "Complement" },
  { value: "rank", label: "Rank" },
  { value: "healthConditions", label: "Health Conditions" },
  { value: "bodySystems", label: "Body Systems" },
];

interface ColumnMapping {
  excelColumn: string;
  dbField: string;
}

const ExcelImportForm = () => {
  const [file, setFile] = useState<File | null>(null);
  const [attachedFile, setAttachedFile] = useState<string>("");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [autoMapFields, setAutoMapFields] = useState(true);

  // Mutation for analyzing Excel file headers
  const analyzeFileMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/analyze-excel-file", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`File analysis failed: ${response.statusText}`);
      }
      return response.json() as Promise<{ columns: string[] }>;
    },
    onSuccess: (data) => {
      if (!data.columns || data.columns.length === 0) {
        toast({
          title: "File Analysis Issue",
          description:
            "Could not extract columns from file. The file may be empty or in an unexpected format.",
          variant: "destructive",
        });
        return;
      }

      setFileColumns(data.columns || []);

      // Auto-map columns if enabled
      if (autoMapFields) {
        const mappings: ColumnMapping[] = [];
        data.columns.forEach((column) => {
          // Try to find a matching database field
          const matchingField = dbFields.find(
            (field) =>
              field.label.toLowerCase() === column.toLowerCase() ||
              field.value.toLowerCase() ===
                column.toLowerCase().replace(/\s+/g, "_"),
          );

          if (matchingField) {
            mappings.push({
              excelColumn: column,
              dbField: matchingField.value,
            });
          } else {
            mappings.push({
              excelColumn: column,
              dbField: "", // Empty means "Do not import this column"
            });
          }
        });

        setColumnMappings(mappings);
      } else {
        // Create empty mappings
        setColumnMappings(
          data.columns.map((column) => ({
            excelColumn: column,
            dbField: "",
          })),
        );
      }

      setShowMappingDialog(true);
    },
    onError: (error: any) => {
      toast({
        title: "File Analysis Failed",
        description: error.message || "Failed to analyze file headers",
        variant: "destructive",
      });
    },
  });

  // Mutation for uploading Excel file with mappings
  const uploadMutation = useMutation({
    mutationFn: async ({
      formData,
      mappings,
    }: {
      formData: FormData;
      mappings: ColumnMapping[];
    }) => {
      // Add the column mappings to the form data
      formData.append("columnMappings", JSON.stringify(mappings));

      const response = await fetch("/api/import-excel", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }
      return response.json() as Promise<ImportResponse>;
    },
    onSuccess: (data) => {
      toast({
        title: "Import Successful",
        description: `${data.imported || 0} out of ${data.total || 0} studies were imported.`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description:
          error.message || "Failed to import studies from Excel file",
        variant: "destructive",
      });
    },
  });

  // Mutation for importing from attached file
  const attachedFileMutation = useMutation({
    mutationFn: async (data: { filePath: string; fileType: string }) => {
      const response = await fetch("/api/import/attached", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }
      return response.json() as Promise<ImportResponse>;
    },
    onSuccess: (data) => {
      toast({
        title: "Import Successful",
        description: `${data.imported || 0} out of ${data.total || 0} studies were imported.`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description:
          error.message || "Failed to import studies from attached file",
        variant: "destructive",
      });
    },
  });

  // Handle file selection and analyze columns
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      // Analyze file to extract columns
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("fileType", "xlsx");
      analyzeFileMutation.mutate(formData);
    }
  };

  // Handle file upload submission with field mapping
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select an Excel file to upload",
        variant: "destructive",
      });
      return;
    }

    if (columnMappings.length === 0) {
      toast({
        title: "Column Mappings Required",
        description:
          "Please wait for file analysis to complete or configure column mappings",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileType", "xlsx");

    uploadMutation.mutate({ formData, mappings: columnMappings });
  };

  // Handle updating a column mapping
  const handleUpdateMapping = (excelColumn: string, dbField: string) => {
    setColumnMappings((prevMappings) =>
      prevMappings.map((mapping) =>
        mapping.excelColumn === excelColumn ? { ...mapping, dbField } : mapping,
      ),
    );
  };

  // Handle attached file import
  const handleAttachedFileImport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!attachedFile) {
      toast({
        title: "No File Specified",
        description: "Please specify the path to the attached Excel file",
        variant: "destructive",
      });
      return;
    }

    attachedFileMutation.mutate({
      filePath: attachedFile,
      fileType: "xlsx",
    });
  };

  // For the hydrogen research database file
  const hydrogenDatabaseMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/import-hydrogen-database", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }
      return response.json() as Promise<ImportResponse>;
    },
    onSuccess: (data) => {
      toast({
        title: "Import Successful",
        description: `${data.imported || 0} out of ${data.total || 0} studies were imported from Hydrogen Research Database.`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description:
          error.message || "Failed to import Hydrogen Research Database",
        variant: "destructive",
      });
    },
  });

  const handleImportHydrogenDatabase = () => {
    hydrogenDatabaseMutation.mutate();
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Excel Data
          </CardTitle>
          <CardDescription>
            Upload Excel files containing hydrogen research studies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="excelFile">Excel File (.xlsx, .xls)</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-map"
                    checked={autoMapFields}
                    onCheckedChange={(checked) => setAutoMapFields(!!checked)}
                  />
                  <Label htmlFor="auto-map" className="text-sm">
                    Auto-map fields
                  </Label>
                </div>
              </div>
              <Input
                id="excelFile"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                ref={fileInputRef}
              />
              <p className="text-sm text-gray-500">
                Upload any Excel file - our field mapping tool will help you
                match columns to database fields.
              </p>
            </div>

            {fileColumns.length > 0 && (
              <div className="mb-4">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowMappingDialog(true)}
                  className="w-full"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Edit Column Mappings (
                  {columnMappings.filter((m) => m.dbField).length} of{" "}
                  {fileColumns.length} mapped)
                </Button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={
                !file ||
                uploadMutation.isPending ||
                analyzeFileMutation.isPending ||
                columnMappings.length === 0
              }
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : analyzeFileMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing File...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload With Field Mapping
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import from Project Files</CardTitle>
          <CardDescription>
            Import from Excel files already attached to the project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAttachedFileImport} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="attachedFilePath">File Path</Label>
              <Input
                id="attachedFilePath"
                type="text"
                placeholder="./attached_assets/example.xlsx"
                value={attachedFile}
                onChange={(e) => setAttachedFile(e.target.value)}
              />
              <p className="text-sm text-gray-500">
                Specify the path to an Excel file in the project
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!attachedFile || attachedFileMutation.isPending}
            >
              {attachedFileMutation.isPending ? (
                <>Processing...</>
              ) : (
                <>Import from Path</>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col">
          <div className="w-full pt-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleImportHydrogenDatabase}
              disabled={attachedFileMutation.isPending}
            >
              {attachedFileMutation.isPending ? (
                <>Processing...</>
              ) : (
                <>Import Hydrogen Research Database</>
              )}
            </Button>
            <p className="text-sm text-gray-500 mt-2">
              Quick action to import the Hydrogen Research Database file with
              245 studies
            </p>
          </div>
        </CardFooter>
      </Card>

      {(uploadMutation.isSuccess || attachedFileMutation.isSuccess) && (
        <Alert className="bg-green-50 border-green-500">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertTitle>Import Successful</AlertTitle>
          <AlertDescription>
            {uploadMutation.isSuccess && uploadMutation.data && (
              <p>
                Successfully imported {uploadMutation.data.imported || 0} out of{" "}
                {uploadMutation.data.total || 0} studies.
              </p>
            )}
            {attachedFileMutation.isSuccess && attachedFileMutation.data && (
              <p>
                Successfully imported {attachedFileMutation.data.imported || 0}{" "}
                out of {attachedFileMutation.data.total || 0} studies.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {(uploadMutation.isError || attachedFileMutation.isError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Import Failed</AlertTitle>
          <AlertDescription>
            {uploadMutation.error instanceof Error && (
              <p>{uploadMutation.error.message}</p>
            )}
            {attachedFileMutation.error instanceof Error && (
              <p>{attachedFileMutation.error.message}</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <FieldMappingDialog
        open={showMappingDialog}
        onOpenChange={setShowMappingDialog}
        columnMappings={columnMappings}
        onUpdateMapping={handleUpdateMapping}
        onSave={() => setShowMappingDialog(false)}
        onCancel={() => setShowMappingDialog(false)}
        dbFields={dbFields}
      />
    </div>
  );
};

export default ExcelImportForm;
