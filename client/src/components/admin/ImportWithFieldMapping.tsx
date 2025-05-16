import React, { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, FileSpreadsheet, Upload, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import FieldMappingDialog from './FieldMappingDialog';

interface ImportResponse {
  success: boolean;
  message?: string;
  total?: number;
  imported?: number;
  errors?: string[];
}

interface ColumnMapping {
  excelColumn: string;
  dbField: string;
}

// Database fields and their user-friendly names
const dbFields = [
  { value: 'title', label: 'Title' },
  { value: 'abstract', label: 'Abstract' },
  { value: 'year', label: 'Year' },
  { value: 'journal', label: 'Journal' },
  { value: 'url', label: 'URL/DOI/PMID' },
  { value: 'type', label: 'Study Type' },
  { value: 'methods', label: 'Methods' },
  { value: 'model', label: 'Model' },
  { value: 'country', label: 'Country' },
  { value: 'authors', label: 'Authors' },
  { value: 'peerReviewed', label: 'Peer Reviewed' },
  { value: 'categoryId', label: 'Category ID' },
  { value: 'first_author', label: 'First Author' },
  { value: 'other_authors', label: 'Other Authors' },
  { value: 'last_author', label: 'Last Author' },
  { value: 'primary_topic', label: 'Primary Topic' },
  { value: 'secondary_topic', label: 'Secondary Topic' },
  { value: 'tertiary_topic', label: 'Tertiary Topic' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'ph', label: 'pH' },
  { value: 'application', label: 'Application' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'complement', label: 'Complement' },
  { value: 'rank', label: 'Rank' },
  { value: 'healthConditions', label: 'Health Conditions' },
  { value: 'bodySystems', label: 'Body Systems' }
];

export default function ImportWithFieldMapping() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<'xlsx' | 'csv'>('xlsx');
  const [urlInput, setUrlInput] = useState('');
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [autoMapFields, setAutoMapFields] = useState(true);

  // For direct file upload with mapping
  const fileMutation = useMutation({
    mutationFn: async ({ formData, mappings }: { formData: FormData, mappings: ColumnMapping[] }) => {
      // Add the column mappings to the form data
      formData.append('columnMappings', JSON.stringify(mappings));
      
      const response = await fetch('/api/import-excel', {
        method: 'POST',
        body: formData
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
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFileColumns([]);
      setColumnMappings([]);
      setShowMappingDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import file",
        variant: "destructive",
      });
    },
  });

  // For importing from URL with mapping
  const urlMutation = useMutation({
    mutationFn: async ({ url, mappings }: { url: string, mappings: ColumnMapping[] }) => {
      const response = await fetch('/api/import-from-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          url, 
          fileType: importType,
          columnMappings: mappings
        })
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
      setUrlInput('');
      setFileColumns([]);
      setColumnMappings([]);
      setShowMappingDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import from URL",
        variant: "destructive",
      });
    },
  });

  // For getting file headers
  const analyzeFileMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/analyze-excel-file', {
        method: 'POST',
        body: formData
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
          description: "Could not extract columns from file. The file may be empty or in an unexpected format.",
          variant: "destructive",
        });
        return;
      }
      
      setFileColumns(data.columns || []);
      
      // Auto-map columns if enabled
      if (autoMapFields) {
        const mappings: ColumnMapping[] = [];
        data.columns.forEach(column => {
          // Try to find a matching database field
          const matchingField = dbFields.find(field => 
            field.label.toLowerCase() === column.toLowerCase() ||
            field.value.toLowerCase() === column.toLowerCase().replace(/\s+/g, '_')
          );
          
          if (matchingField) {
            mappings.push({
              excelColumn: column,
              dbField: matchingField.value
            });
          } else {
            mappings.push({
              excelColumn: column,
              dbField: '' // Empty means "Do not import this column"
            });
          }
        });
        
        setColumnMappings(mappings);
      } else {
        // Create empty mappings
        setColumnMappings(data.columns.map(column => ({
          excelColumn: column,
          dbField: ''
        })));
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

  // For URL file headers
  const analyzeUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch('/api/analyze-url-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url, fileType: importType })
      });
      if (!response.ok) {
        throw new Error(`File analysis failed: ${response.statusText}`);
      }
      return response.json() as Promise<{ columns: string[] }>;
    },
    onSuccess: (data) => {
      if (!data.columns || data.columns.length === 0) {
        toast({
          title: "URL Analysis Issue",
          description: "Could not extract columns from file. The file may be empty or in an unexpected format.",
          variant: "destructive",
        });
        return;
      }
      
      setFileColumns(data.columns || []);
      
      // Auto-map columns if enabled
      if (autoMapFields) {
        const mappings: ColumnMapping[] = [];
        data.columns.forEach(column => {
          // Try to find a matching database field
          const matchingField = dbFields.find(field => 
            field.label.toLowerCase() === column.toLowerCase() ||
            field.value.toLowerCase() === column.toLowerCase().replace(/\s+/g, '_')
          );
          
          if (matchingField) {
            mappings.push({
              excelColumn: column,
              dbField: matchingField.value
            });
          } else {
            mappings.push({
              excelColumn: column,
              dbField: '' // Empty means "Do not import this column"
            });
          }
        });
        
        setColumnMappings(mappings);
      } else {
        // Create empty mappings
        setColumnMappings(data.columns.map(column => ({
          excelColumn: column,
          dbField: ''
        })));
      }
      
      setShowMappingDialog(true);
    },
    onError: (error: any) => {
      toast({
        title: "URL Analysis Failed",
        description: error.message || "Failed to analyze file headers from URL",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
      
      // Analyze file as soon as it's selected
      const formData = new FormData();
      formData.append('file', event.target.files[0]);
      formData.append('fileType', importType);
      analyzeFileMutation.mutate(formData);
    }
  };

  const handleFileUpload = () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    if (columnMappings.length === 0) {
      toast({
        title: "No Column Mappings",
        description: "Please analyze the file first to set up column mappings",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('fileType', importType);
    
    fileMutation.mutate({ formData, mappings: columnMappings });
  };

  const handleUrlAnalyze = () => {
    if (!urlInput || !urlInput.trim()) {
      toast({
        title: "No URL Provided",
        description: "Please enter a URL to import from",
        variant: "destructive",
      });
      return;
    }

    analyzeUrlMutation.mutate(urlInput);
  };

  const handleUrlImport = () => {
    if (!urlInput || !urlInput.trim()) {
      toast({
        title: "No URL Provided",
        description: "Please enter a URL to import from",
        variant: "destructive",
      });
      return;
    }

    if (columnMappings.length === 0) {
      toast({
        title: "No Column Mappings",
        description: "Please analyze the URL first to set up column mappings",
        variant: "destructive",
      });
      return;
    }

    urlMutation.mutate({ url: urlInput, mappings: columnMappings });
  };

  const handleUpdateMapping = (excelColumn: string, dbField: string) => {
    setColumnMappings(prevMappings => 
      prevMappings.map(mapping => 
        mapping.excelColumn === excelColumn 
          ? { ...mapping, dbField } 
          : mapping
      )
    );
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Import with Field Mapping</CardTitle>
          <CardDescription>
            Import studies from Excel or CSV files with custom field mapping
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="file">
            <TabsList className="mb-4">
              <TabsTrigger value="file">Upload File</TabsTrigger>
              <TabsTrigger value="url">Import from URL</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4">
              <div>
                <div className="grid gap-4 mb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <TabsTrigger 
                        value="xlsx" 
                        className={importType === 'xlsx' ? 'bg-primary text-primary-foreground' : ''}
                        onClick={() => setImportType('xlsx')}
                      >
                        Excel (.xlsx)
                      </TabsTrigger>
                      <TabsTrigger 
                        value="csv" 
                        className={importType === 'csv' ? 'bg-primary text-primary-foreground' : ''}
                        onClick={() => setImportType('csv')}
                      >
                        CSV (.csv)
                      </TabsTrigger>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="file" 
                      ref={fileInputRef}
                      accept={importType === 'xlsx' ? '.xlsx' : '.csv'} 
                      onChange={handleFileChange} 
                      className="flex-1"
                    />
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="auto-map" 
                        checked={autoMapFields} 
                        onCheckedChange={(checked) => setAutoMapFields(!!checked)} 
                      />
                      <Label htmlFor="auto-map">Auto-map fields</Label>
                    </div>
                  </div>
                </div>
                
                {fileColumns.length > 0 && (
                  <div className="mb-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowMappingDialog(true)}
                    >
                      Edit Column Mappings
                    </Button>
                  </div>
                )}
                
                <Button 
                  onClick={handleFileUpload} 
                  disabled={!selectedFile || fileMutation.isPending || analyzeFileMutation.isPending || columnMappings.length === 0}
                >
                  {fileMutation.isPending ? (
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
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Upload & Import
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="url" className="space-y-4">
              <div className="grid gap-4 mb-4">
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <TabsTrigger 
                      value="xlsx-url" 
                      className={importType === 'xlsx' ? 'bg-primary text-primary-foreground' : ''}
                      onClick={() => setImportType('xlsx')}
                    >
                      Excel (.xlsx)
                    </TabsTrigger>
                    <TabsTrigger 
                      value="csv-url" 
                      className={importType === 'csv' ? 'bg-primary text-primary-foreground' : ''}
                      onClick={() => setImportType('csv')}
                    >
                      CSV (.csv)
                    </TabsTrigger>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input 
                      placeholder="Enter URL to Excel or CSV file" 
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="flex-1"
                    />
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="auto-map-url" 
                        checked={autoMapFields} 
                        onCheckedChange={(checked) => setAutoMapFields(!!checked)} 
                      />
                      <Label htmlFor="auto-map-url">Auto-map fields</Label>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    variant="outline"
                    onClick={handleUrlAnalyze} 
                    disabled={!urlInput.trim() || analyzeUrlMutation.isPending}
                  >
                    {analyzeUrlMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Analyze URL
                      </>
                    )}
                  </Button>
                  
                  {fileColumns.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => setShowMappingDialog(true)}
                    >
                      Edit Column Mappings
                    </Button>
                  )}
                </div>
                
                <Button 
                  onClick={handleUrlImport} 
                  disabled={!urlInput.trim() || urlMutation.isPending || columnMappings.length === 0}
                >
                  {urlMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Import from URL
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      <FieldMappingDialog
        open={showMappingDialog}
        onOpenChange={setShowMappingDialog}
        columnMappings={columnMappings}
        onUpdateMapping={handleUpdateMapping}
        onSave={() => setShowMappingDialog(false)}
        onCancel={() => setShowMappingDialog(false)}
        dbFields={dbFields}
      />
    </>
  );
}