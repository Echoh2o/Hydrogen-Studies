import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, FileSpreadsheet, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ImportResponse } from "@/types/import";

const ExcelImportForm = () => {
  const [file, setFile] = useState<File | null>(null);
  const [attachedFile, setAttachedFile] = useState<string>("");
  const { toast } = useToast();

  // Mutation for uploading Excel file
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/import/excel', {
        method: 'POST',
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
        description: error.message || "Failed to import studies from Excel file",
        variant: "destructive",
      });
    },
  });

  // Mutation for importing from attached file
  const attachedFileMutation = useMutation({
    mutationFn: async (data: { filePath: string; fileType: string }) => {
      const response = await fetch('/api/import/attached', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        description: error.message || "Failed to import studies from attached file",
        variant: "destructive",
      });
    },
  });

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  // Handle file upload submission
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

    const formData = new FormData();
    formData.append('excelFile', file);
    
    uploadMutation.mutate(formData);
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
      fileType: 'xlsx'
    });
  };

  // For the hydrogen research database file
  const hydrogenDatabaseMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/import-hydrogen-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
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
        description: error.message || "Failed to import Hydrogen Research Database",
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
              <Label htmlFor="excelFile">Excel File (.xlsx, .xls)</Label>
              <Input
                id="excelFile"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
              />
              <p className="text-sm text-gray-500">
                File should contain research studies with headers matching the database fields.
              </p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={!file || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <>Processing...</>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Excel File
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
              Quick action to import the Hydrogen Research Database file with 245 studies
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
              <p>Successfully imported {uploadMutation.data.imported || 0} out of {uploadMutation.data.total || 0} studies.</p>
            )}
            {attachedFileMutation.isSuccess && attachedFileMutation.data && (
              <p>Successfully imported {attachedFileMutation.data.imported || 0} out of {attachedFileMutation.data.total || 0} studies.</p>
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
    </div>
  );
};

export default ExcelImportForm;