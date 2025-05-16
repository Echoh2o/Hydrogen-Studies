import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { 
  FileSpreadsheet, 
  Upload, 
  FileText, 
  AlertCircle, 
  Loader2 
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function DataImportPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('excel');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setExcelFile(file);
      } else {
        toast({
          title: "Invalid file format",
          description: "Please upload an Excel file (.xlsx or .xls)",
          variant: "destructive",
        });
      }
    }
  };
  
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith('.csv')) {
        setCsvFile(file);
      } else {
        toast({
          title: "Invalid file format",
          description: "Please upload a CSV file (.csv)",
          variant: "destructive",
        });
      }
    }
  };
  
  const handleSubmit = async (type: string) => {
    setIsSubmitting(true);
    
    // Here we would implement the actual file upload and data import logic
    
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Feature not implemented",
        description: `${type} import will be implemented in a future update`,
      });
      setIsSubmitting(false);
    }, 1500);
  };
  
  return (
    <AdminLayout 
      title="Data Import" 
      description="Import research studies from data files and spreadsheets"
    >
      <Helmet>
        <title>Data Import | HydrogenStudies Admin</title>
      </Helmet>
      
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Data Import</h2>
            <p className="text-muted-foreground">
              Import research studies from Excel, CSV, Google Sheets, and more
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-2">
            <Button variant="outline" className="hidden md:flex" asChild>
              <a href="/admin/research-import">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Research Import
              </a>
            </Button>
          </div>
        </div>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            <p className="mb-2">For best results, your file should have the following columns:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li><strong>Required:</strong> title, authors, abstract, journal, publish_date</li>
              <li><strong>Optional:</strong> doi, pdf_url, citation_url, category, methods, results, conclusion, peer_reviewed</li>
            </ul>
          </AlertDescription>
        </Alert>
        
        <Card>
          <CardHeader>
            <CardTitle>Import from File</CardTitle>
            <CardDescription>
              Upload data files to import hydrogen research studies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="space-y-4"
            >
              <TabsList className="grid grid-cols-3 w-full max-w-md">
                <TabsTrigger value="excel">
                  <div className="flex items-center">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline-block">Excel</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="csv">
                  <div className="flex items-center">
                    <FileText className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline-block">CSV</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="gsheets">
                  <div className="flex items-center">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline-block">Google Sheets</span>
                  </div>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="excel" className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p>Upload an Excel file (.xlsx or .xls) containing study data.</p>
                </div>
                
                <div className="grid w-full items-center gap-4">
                  <div className="flex flex-col space-y-1.5">
                    <Label htmlFor="excel-file">Excel File</Label>
                    <Input
                      id="excel-file"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelUpload}
                    />
                    <p className="text-xs text-muted-foreground">
                      Select an Excel file to upload
                    </p>
                  </div>
                  
                  <Button 
                    onClick={() => handleSubmit('Excel')} 
                    disabled={!excelFile || isSubmitting}
                  >
                    {isSubmitting && activeTab === 'excel' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Import Excel Data
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="csv" className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p>Upload a CSV file containing study data.</p>
                </div>
                
                <div className="grid w-full items-center gap-4">
                  <div className="flex flex-col space-y-1.5">
                    <Label htmlFor="csv-file">CSV File</Label>
                    <Input
                      id="csv-file"
                      type="file"
                      accept=".csv"
                      onChange={handleCsvUpload}
                    />
                    <p className="text-xs text-muted-foreground">
                      Select a CSV file to upload
                    </p>
                  </div>
                  
                  <Button 
                    onClick={() => handleSubmit('CSV')} 
                    disabled={!csvFile || isSubmitting}
                  >
                    {isSubmitting && activeTab === 'csv' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Import CSV Data
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="gsheets" className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p>Import data from a Google Sheets spreadsheet. The sheet must be publicly accessible or shared.</p>
                </div>
                
                <div className="grid w-full items-center gap-4">
                  <div className="flex flex-col space-y-1.5">
                    <Label htmlFor="gsheet-url">Google Sheet URL</Label>
                    <Input
                      id="gsheet-url"
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Paste the URL of a publicly accessible Google Sheet
                    </p>
                  </div>
                  
                  <Button 
                    onClick={() => handleSubmit('Google Sheets')} 
                    disabled={!googleSheetUrl || isSubmitting}
                  >
                    {isSubmitting && activeTab === 'gsheets' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Import Google Sheet Data
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sample Files</CardTitle>
              <CardDescription>
                Download sample templates for data import
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Download template files to help you format your data correctly for import.
              </p>
              <div className="flex flex-col space-y-2">
                <Button variant="outline" className="justify-start">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Download Excel Template
                </Button>
                <Button variant="outline" className="justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Download CSV Template
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Column Mapping</CardTitle>
              <CardDescription>
                Match your data columns to our database fields
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If your file has different column names, you can map them to our expected fields during import.
              </p>
              <Button variant="outline" className="w-full" disabled>
                Column Mapping Tool
                <span className="ml-2 text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">Coming Soon</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}