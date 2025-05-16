import React from 'react';
import { ImportForm } from '@/components/admin/ImportForm';
import ExcelImportForm from '@/components/admin/ExcelImportForm';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ImportPage() {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Research Database</h1>
          <p className="text-muted-foreground mt-2">
            Import hydrogen research studies from Excel files and other sources
          </p>
        </div>
        <div>
          <Button variant="outline" asChild>
            <Link href="/admin">Back to Admin</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <Tabs defaultValue="excel" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="excel">Excel Import</TabsTrigger>
            <TabsTrigger value="general">General Import</TabsTrigger>
          </TabsList>
          
          <TabsContent value="excel" className="mt-4">
            <ExcelImportForm />
          </TabsContent>
          
          <TabsContent value="general" className="mt-4">
            <ImportForm />
          </TabsContent>
        </Tabs>
        
        <div className="bg-muted p-4 rounded-lg">
          <h3 className="font-medium mb-2">Excel File Format Guide</h3>
          <p className="text-sm mb-3">
            Your Excel file should contain columns that match our database structure. The system supports
            specific column names from your Hydrogen Research Database format.
          </p>
          <div className="text-xs space-y-1">
            <p><strong>Required columns:</strong> Title, Abstract, Authors/First Author, Journal, Publish Date/Year</p>
            <p><strong>Optional columns:</strong> Primary Topic, Secondary Topic, Model, Category, Methods, Results, Conclusion, DOI, PDF URL, 
            Peer Reviewed, Country, Region, Study Type, Sample Size, Duration, Health Conditions, Body Systems</p>
          </div>
        </div>
        
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Alternative Import Methods</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" className="h-auto p-4 justify-start" onClick={() => alert('Starting scraper...')}>
              <div className="text-left">
                <div className="font-medium">Run Hydrogen Studies Scraper</div>
                <div className="text-sm text-muted-foreground">
                  Automatically discover and import studies from hydrogenstudies.com
                </div>
              </div>
            </Button>
            <Button variant="outline" className="h-auto p-4 justify-start" onClick={() => alert('Coming soon...')}>
              <div className="text-left">
                <div className="font-medium">Import from PubMed</div>
                <div className="text-sm text-muted-foreground">
                  Search and import studies directly from PubMed database
                </div>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}