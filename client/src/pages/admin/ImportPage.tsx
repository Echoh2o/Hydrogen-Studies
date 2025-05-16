import React from 'react';
import { ImportForm } from '@/components/admin/ImportForm';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

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
        <div className="grid grid-cols-1 gap-6">
          <ImportForm />
        </div>
        
        <div className="bg-muted p-4 rounded-lg">
          <h3 className="font-medium mb-2">Excel File Format Guide</h3>
          <p className="text-sm mb-3">
            Your Excel file should contain columns that match our database structure. The importer
            will try to map columns automatically based on headers.
          </p>
          <div className="text-xs space-y-1">
            <p><strong>Required columns:</strong> Title, Abstract, Authors, Journal, Publish Date</p>
            <p><strong>Optional columns:</strong> Category, Methods, Results, Conclusion, DOI, PDF URL, Citation URL, Peer Reviewed, 
            Publish Year, Country, Region, Study Type, Sample Size, Duration</p>
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