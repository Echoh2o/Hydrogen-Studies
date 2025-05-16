import { useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Loader2,
  Upload,
  FileSpreadsheet,
  FileJson,
  FileText,
  Table,
  Globe,
  RefreshCw,
  Check,
  X,
  Info
} from 'lucide-react';

export default function DataImportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('file-import');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [importHistory, setImportHistory] = useState<any[]>([]);
  
  // Import file mutation
  const importFileMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      setImportProgress(10);
      setImportStatus('Starting import...');
      
      const response = await apiRequest("POST", "/api/admin/import", formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setImportProgress(90);
      setImportStatus('Processing data...');
      
      return response.json();
    },
    onSuccess: (data) => {
      setImportProgress(100);
      setImportStatus('Import complete!');
      
      toast({
        title: "Import successful",
        description: `Successfully imported ${data.success} out of ${data.total} studies.`,
      });
      
      // Update import history
      setImportHistory(prev => [
        {
          id: Date.now(),
          type: 'file',
          status: 'success',
          count: data.success,
          total: data.total,
          date: new Date().toISOString()
        },
        ...prev.slice(0, 4)
      ]);
      
      queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
      
      // Reset progress after a delay
      setTimeout(() => {
        setImportProgress(0);
        setImportStatus(null);
      }, 3000);
    },
    onError: (error: any) => {
      setImportProgress(100);
      setImportStatus('Import failed');
      
      toast({
        title: "Import failed",
        description: error.message || "Failed to import studies",
        variant: "destructive",
      });
      
      // Update import history
      setImportHistory(prev => [
        {
          id: Date.now(),
          type: 'file',
          status: 'failed',
          error: error.message,
          date: new Date().toISOString()
        },
        ...prev.slice(0, 4)
      ]);
      
      // Reset progress after a delay
      setTimeout(() => {
        setImportProgress(0);
        setImportStatus(null);
      }, 3000);
    },
    onSettled: () => {
      setIsImporting(false);
    }
  });
  
  // Google Sheet import mutation
  const importGoogleSheetMutation = useMutation({
    mutationFn: async (url: string) => {
      setImportProgress(10);
      setImportStatus('Connecting to Google Sheets...');
      
      const response = await apiRequest("POST", "/api/admin/import/googlesheet", { url });
      
      setImportProgress(50);
      setImportStatus('Importing data...');
      
      return response.json();
    },
    onSuccess: (data) => {
      setImportProgress(100);
      setImportStatus('Import complete!');
      
      toast({
        title: "Import successful",
        description: `Successfully imported ${data.success} out of ${data.total} studies from Google Sheet.`,
      });
      
      // Update import history
      setImportHistory(prev => [
        {
          id: Date.now(),
          type: 'googlesheet',
          status: 'success',
          count: data.success,
          total: data.total,
          date: new Date().toISOString()
        },
        ...prev.slice(0, 4)
      ]);
      
      queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
      
      // Reset Google Sheet URL
      setGoogleSheetUrl('');
      
      // Reset progress after a delay
      setTimeout(() => {
        setImportProgress(0);
        setImportStatus(null);
      }, 3000);
    },
    onError: (error: any) => {
      setImportProgress(100);
      setImportStatus('Import failed');
      
      toast({
        title: "Google Sheet import failed",
        description: error.message || "Failed to import studies from Google Sheet",
        variant: "destructive",
      });
      
      // Update import history
      setImportHistory(prev => [
        {
          id: Date.now(),
          type: 'googlesheet',
          status: 'failed',
          error: error.message,
          date: new Date().toISOString()
        },
        ...prev.slice(0, 4)
      ]);
      
      // Reset progress after a delay
      setTimeout(() => {
        setImportProgress(0);
        setImportStatus(null);
      }, 3000);
    },
    onSettled: () => {
      setIsImporting(false);
    }
  });

  // Website scraping mutation
  const scrapeMutation = useMutation({
    mutationFn: async () => {
      setImportProgress(10);
      setImportStatus('Starting scraper...');
      
      const response = await apiRequest("POST", "/api/admin/scrape");
      
      setImportProgress(30);
      setImportStatus('Scraping website...');
      
      return response.json();
    },
    onSuccess: (data) => {
      setImportProgress(100);
      setImportStatus('Scraping complete!');
      
      toast({
        title: "Scraping successful",
        description: `Successfully scraped ${data.success} out of ${data.total} studies.`,
      });
      
      // Update import history
      setImportHistory(prev => [
        {
          id: Date.now(),
          type: 'scrape',
          status: 'success',
          count: data.success,
          total: data.total,
          date: new Date().toISOString()
        },
        ...prev.slice(0, 4)
      ]);
      
      queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
      
      // Reset progress after a delay
      setTimeout(() => {
        setImportProgress(0);
        setImportStatus(null);
      }, 3000);
    },
    onError: (error: any) => {
      setImportProgress(100);
      setImportStatus('Scraping failed');
      
      toast({
        title: "Scraping failed",
        description: error.message || "Failed to scrape studies",
        variant: "destructive",
      });
      
      // Update import history
      setImportHistory(prev => [
        {
          id: Date.now(),
          type: 'scrape',
          status: 'failed',
          error: error.message,
          date: new Date().toISOString()
        },
        ...prev.slice(0, 4)
      ]);
      
      // Reset progress after a delay
      setTimeout(() => {
        setImportProgress(0);
        setImportStatus(null);
      }, 3000);
    },
    onSettled: () => {
      setIsImporting(false);
    }
  });
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    let fileType = '';
    if (type === 'excel') {
      fileType = 'excel';
    } else {
      fileType = file.name.endsWith('.csv') 
        ? 'csv' 
        : file.name.endsWith('.json') 
          ? 'json' 
          : '';
    }
    
    if (!fileType) {
      toast({
        title: "Invalid file format",
        description: "Please upload a supported file format",
        variant: "destructive",
      });
      return;
    }
    
    formData.append('fileType', fileType);
    setIsImporting(true);
    importFileMutation.mutate(formData);
  };
  
  const handleGoogleSheetImport = () => {
    if (!googleSheetUrl) {
      toast({
        title: "URL required",
        description: "Please enter a Google Sheet URL",
        variant: "destructive",
      });
      return;
    }
    
    setIsImporting(true);
    importGoogleSheetMutation.mutate(googleSheetUrl);
  };
  
  const handleScrapeWebsite = () => {
    setIsImporting(true);
    scrapeMutation.mutate();
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  return (
    <AdminLayout 
      title="Data Import" 
      description="Import studies from various data sources"
    >
      <div className="space-y-6">
        {/* Progress Indicator */}
        {importProgress > 0 && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="flex justify-between mb-1 items-center">
                    <div className="text-sm font-medium">{importStatus || 'Importing...'}</div>
                    <div className="text-sm font-medium">{importProgress}%</div>
                  </div>
                  <Progress value={importProgress} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Import Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 gap-2">
            <TabsTrigger value="file-import">File Import</TabsTrigger>
            <TabsTrigger value="excel-import">Excel Import</TabsTrigger>
            <TabsTrigger value="google-sheets">Google Sheets</TabsTrigger>
            <TabsTrigger value="website-scrape">Website Scrape</TabsTrigger>
          </TabsList>
          
          {/* File Import Tab */}
          <TabsContent value="file-import" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Import from File</CardTitle>
                <CardDescription>Import studies from a CSV or JSON file</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Upload a CSV or JSON file containing study data. The file should 
                    have columns/fields matching the study schema (title, abstract, authors, etc).
                  </p>
                  
                  <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-md p-6">
                    <FileText className="h-10 w-10 text-neutral-400 mb-2" />
                    <p className="text-sm text-neutral-500 mb-4">Upload a CSV or JSON file</p>
                    <Input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".csv,.json"
                      onChange={(e) => handleFileUpload(e, 'standard')}
                    />
                    <div className="space-y-2">
                      <Button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                      >
                        {isImporting && activeTab === 'file-import' ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload File
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* File format explanation */}
                  <div className="bg-neutral-50 p-4 rounded-md border text-sm">
                    <h4 className="font-medium mb-2 flex items-center"><Info className="h-4 w-4 mr-1" /> Supported File Formats</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="font-medium flex items-center">
                          <FileText className="h-4 w-4 mr-1 text-blue-500" /> CSV
                        </div>
                        <p className="text-xs text-neutral-600 mt-1">
                          Comma-separated values with headers. Required columns: title, authors, abstract, journal, publishDate
                        </p>
                      </div>
                      <div>
                        <div className="font-medium flex items-center">
                          <FileJson className="h-4 w-4 mr-1 text-green-500" /> JSON
                        </div>
                        <p className="text-xs text-neutral-600 mt-1">
                          JSON array of study objects with required fields: title, authors, abstract, journal, publishDate
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Excel Import Tab */}
          <TabsContent value="excel-import" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Excel Import</CardTitle>
                <CardDescription>Import studies from an Excel spreadsheet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Upload an Excel file (.xlsx) containing hydrogen research data. This importer is
                    optimized for the standard hydrogen research database format with automatic field mapping.
                  </p>
                  
                  <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-md p-6">
                    <FileSpreadsheet className="h-10 w-10 text-green-600 mb-2" />
                    <p className="text-sm text-neutral-500 mb-4">Upload an Excel file (.xlsx)</p>
                    <Input
                      type="file"
                      ref={excelFileInputRef}
                      className="hidden"
                      accept=".xlsx,.xls"
                      onChange={(e) => handleFileUpload(e, 'excel')}
                    />
                    <div className="space-y-2">
                      <Button
                        type="button"
                        onClick={() => excelFileInputRef.current?.click()}
                        disabled={isImporting}
                      >
                        {isImporting && activeTab === 'excel-import' ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Excel File
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Excel format explanations */}
                  <div className="bg-neutral-50 p-4 rounded-md border text-sm">
                    <h4 className="font-medium mb-2 flex items-center"><Info className="h-4 w-4 mr-1" /> Excel Format Information</h4>
                    <ul className="space-y-2 text-xs text-neutral-600">
                      <li className="flex items-start">
                        <Table className="h-3.5 w-3.5 mr-1 flex-shrink-0 mt-0.5 text-green-600" />
                        <span>First row should contain column headers. The importer will automatically map common column names.</span>
                      </li>
                      <li className="flex items-start">
                        <Table className="h-3.5 w-3.5 mr-1 flex-shrink-0 mt-0.5 text-green-600" />
                        <span>Date columns can be in various formats (MM/DD/YYYY, YYYY-MM-DD, etc) and will be standardized.</span>
                      </li>
                      <li className="flex items-start">
                        <Table className="h-3.5 w-3.5 mr-1 flex-shrink-0 mt-0.5 text-green-600" />
                        <span>Include as many fields as possible to ensure rich study data, but at minimum, include title, authors, abstract, and publication date.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Google Sheets Tab */}
          <TabsContent value="google-sheets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Google Sheets Import</CardTitle>
                <CardDescription>Import studies from a public Google Sheet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Import hydrogen research data from a publicly shared Google Sheet. The sheet must
                    be shared with "Anyone with the link" and have a similar structure to the Excel import format.
                  </p>
                  
                  <div className="space-y-2">
                    <Label htmlFor="google-sheet-url">Google Sheet URL</Label>
                    <div className="flex">
                      <Input
                        id="google-sheet-url"
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        value={googleSheetUrl}
                        onChange={(e) => setGoogleSheetUrl(e.target.value)}
                        className="flex-1 mr-2"
                      />
                      <Button 
                        onClick={handleGoogleSheetImport}
                        disabled={isImporting || !googleSheetUrl}
                      >
                        {isImporting && activeTab === 'google-sheets' ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Globe className="h-4 w-4 mr-2" />
                            Import
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Google Sheet instructions */}
                  <div className="bg-neutral-50 p-4 rounded-md border text-sm">
                    <h4 className="font-medium mb-2 flex items-center"><Info className="h-4 w-4 mr-1" /> Google Sheets Requirements</h4>
                    <ul className="space-y-2 text-xs text-neutral-600">
                      <li className="flex items-start">
                        <Check className="h-3.5 w-3.5 mr-1 flex-shrink-0 mt-0.5 text-green-600" />
                        <span>Sheet must be publicly accessible (shared with "Anyone with the link can view").</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="h-3.5 w-3.5 mr-1 flex-shrink-0 mt-0.5 text-green-600" />
                        <span>First row should contain column headers similar to Excel format.</span>
                      </li>
                      <li className="flex items-start">
                        <Check className="h-3.5 w-3.5 mr-1 flex-shrink-0 mt-0.5 text-green-600" />
                        <span>Share link format should be: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit?usp=sharing</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Website Scrape Tab */}
          <TabsContent value="website-scrape" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Website Scraping</CardTitle>
                <CardDescription>Import studies by scraping the original hydrogen studies website</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Automatically scrape study data from the original hydrogen studies website.
                    This process will run in the background and may take several minutes depending
                    on the number of studies.
                  </p>
                  
                  <div className="flex justify-center my-6">
                    <Button onClick={handleScrapeWebsite} disabled={isImporting} size="lg">
                      {isImporting && activeTab === 'website-scrape' ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Scraping in progress...
                        </>
                      ) : (
                        <>
                          <Globe className="h-5 w-5 mr-2" />
                          Start Website Scraper
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* Scraper details */}
                  <div className="bg-neutral-50 p-4 rounded-md border text-sm">
                    <h4 className="font-medium mb-2 flex items-center"><Info className="h-4 w-4 mr-1" /> Scraper Information</h4>
                    <ul className="space-y-2 text-xs text-neutral-600">
                      <li className="flex items-start">
                        <Info className="h-3.5 w-3.5 mr-1 flex-shrink-0 mt-0.5 text-blue-600" />
                        <span>The scraper will automatically navigate the hydrogenstudies.com website to find and import study data.</span>
                      </li>
                      <li className="flex items-start">
                        <Info className="h-3.5 w-3.5 mr-1 flex-shrink-0 mt-0.5 text-blue-600" />
                        <span>Scraped studies will include titles, abstracts, authors, and other available metadata.</span>
                      </li>
                      <li className="flex items-start">
                        <Info className="h-3.5 w-3.5 mr-1 flex-shrink-0 mt-0.5 text-blue-600" />
                        <span>The process may take several minutes to complete, depending on the number of studies and website response time.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Import History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Import History</CardTitle>
              <CardDescription>Recent data import activities</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {importHistory.length > 0 ? (
              <div className="space-y-4">
                {importHistory.map(item => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center">
                      {item.status === 'success' ? (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-100 text-green-600 mr-3">
                          <Check className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100 text-red-600 mr-3">
                          <X className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium">
                          {item.type === 'file' && 'File Import'}
                          {item.type === 'excel' && 'Excel Import'}
                          {item.type === 'googlesheet' && 'Google Sheet Import'}
                          {item.type === 'scrape' && 'Website Scrape'}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {formatDate(item.date)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {item.status === 'success' ? (
                        <div className="text-sm text-neutral-700">
                          Imported {item.count}/{item.total} studies
                        </div>
                      ) : (
                        <div className="text-sm text-red-600">
                          {item.error || 'Import failed'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p>No import activity yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}