import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SingleImportData {
  title: string;
  identifier: string;
  autoEnrich: boolean;
}

interface BatchImportData {
  data: string;
  autoEnrich: boolean;
}

interface ImportResponse {
  success: boolean;
  message: string;
  imported?: number;
  total?: number;
  enriched?: number;
  study?: any;
  autoEnriched?: boolean;
}

const SimpleImportForm = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<SingleImportData>({
    title: '',
    identifier: '',
    autoEnrich: true
  });
  const [batchData, setBatchData] = useState<string>('');

  // Handle input changes for single entry form
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle checkbox changes
  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      autoEnrich: checked
    }));
  };

  // Single import mutation
  const singleImportMutation = useMutation({
    mutationFn: async (data: SingleImportData) => {
      const response = await fetch('/api/import/minimal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }
      
      return response.json() as Promise<ImportResponse>;
    },
    onSuccess: (data) => {
      toast({
        title: "Study Added Successfully",
        description: data.autoEnriched ? 
          "The study was added and enriched with data from PubMed." : 
          "The study was added to the database.",
        duration: 5000,
      });
      
      // Reset form
      setFormData({
        title: '',
        identifier: '',
        autoEnrich: true
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to add study",
        variant: "destructive",
      });
    }
  });

  // Batch import mutation
  const batchImportMutation = useMutation({
    mutationFn: async (data: BatchImportData) => {
      const response = await fetch('/api/import/minimal-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Batch import failed: ${response.statusText}`);
      }
      
      return response.json() as Promise<ImportResponse>;
    },
    onSuccess: (data) => {
      toast({
        title: "Batch Import Successful",
        description: `Added ${data.imported} studies. ${data.enriched || 0} studies were enriched with PubMed data.`,
        duration: 5000,
      });
      
      // Reset batch data
      setBatchData('');
    },
    onError: (error: any) => {
      toast({
        title: "Batch Import Failed",
        description: error.message || "Failed to import studies",
        variant: "destructive",
      });
    }
  });

  // Handle single study form submission
  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title && !formData.identifier) {
      toast({
        title: "Missing Information",
        description: "Please provide either a title or an identifier (URL, DOI, or PMID)",
        variant: "destructive",
      });
      return;
    }
    
    singleImportMutation.mutate(formData);
  };

  // Handle batch import submission
  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!batchData.trim()) {
      toast({
        title: "No Data",
        description: "Please enter at least one study identifier or title",
        variant: "destructive",
      });
      return;
    }
    
    batchImportMutation.mutate({
      data: batchData,
      autoEnrich: formData.autoEnrich
    });
  };

  // Enrichment for existing studies
  const enrichMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/enrich/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit: 50 })
      });
      
      if (!response.ok) {
        throw new Error(`Enrichment failed: ${response.statusText}`);
      }
      
      return response.json() as Promise<ImportResponse>;
    },
    onSuccess: (data) => {
      toast({
        title: "Enrichment Successful",
        description: `Enriched ${data.enriched || 0} studies with data from PubMed.`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Enrichment Failed",
        description: error.message || "Failed to enrich studies",
        variant: "destructive",
      });
    }
  });

  return (
    <div className="space-y-8">
      {/* Notice banner */}
      <Alert className="bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-800" />
        <AlertTitle className="text-amber-800">Simplified Import Method</AlertTitle>
        <AlertDescription className="text-amber-700">
          This new method only requires minimal information. Just enter a title or identifier (PMID, DOI, URL) 
          and the system will automatically fetch the complete details from PubMed using your API key.
        </AlertDescription>
      </Alert>

      {/* Single study form */}
      <Card>
        <CardHeader>
          <CardTitle>Add Single Study</CardTitle>
          <CardDescription>
            Enter minimal information and let the system auto-complete the rest
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSingleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">PMID, DOI, or URL</Label>
              <Input
                id="identifier"
                name="identifier"
                value={formData.identifier}
                onChange={handleInputChange}
                placeholder="e.g., 12345678 or https://pubmed.ncbi.nlm.nih.gov/12345678/"
              />
              <p className="text-xs text-muted-foreground">
                Enter a PubMed ID, DOI, or full URL to a study
              </p>
            </div>
            
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="mx-4 flex-shrink text-gray-400 text-sm">OR</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="title">Study Title</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter the full study title"
              />
              <p className="text-xs text-muted-foreground">
                Enter the complete study title if you don't have an identifier
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="autoEnrich" 
                checked={formData.autoEnrich}
                onCheckedChange={handleCheckboxChange}
              />
              <Label htmlFor="autoEnrich" className="text-sm font-normal">
                Automatically fetch full details from PubMed
              </Label>
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={singleImportMutation.isPending || (!formData.title && !formData.identifier)}
            >
              {singleImportMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Study...
                </>
              ) : (
                <>Add Study & Auto-Complete Details</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {/* Batch import form */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Import</CardTitle>
          <CardDescription>
            Import multiple studies at once using titles, PMIDs, DOIs or URLs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBatchSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batchData">
                Enter one study per line (title, URL, DOI, or PMID)
              </Label>
              <Textarea
                id="batchData"
                value={batchData}
                onChange={(e) => setBatchData(e.target.value)}
                placeholder="12345678
https://pubmed.ncbi.nlm.nih.gov/23456789/
10.1016/j.hydrogenStudy.2022.01.001
Hydrogen-rich saline prevents cognitive impairment"
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter each study on a new line - can be titles, PubMed IDs, DOIs, or URLs
              </p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={batchImportMutation.isPending || !batchData.trim()}
            >
              {batchImportMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing Studies...
                </>
              ) : (
                <>Batch Import Studies</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {/* Enrich existing studies */}
      <Card>
        <CardHeader>
          <CardTitle>Enrich Existing Studies</CardTitle>
          <CardDescription>
            Fetch missing details for studies already in the database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm">
              This will search for studies with missing details and try to enrich them with data from PubMed.
              The process runs in the background and processes up to 50 studies at a time.
            </p>
            
            <Button 
              onClick={() => enrichMutation.mutate()}
              className="w-full"
              disabled={enrichMutation.isPending}
            >
              {enrichMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enriching Studies...
                </>
              ) : (
                <>Enrich Existing Studies</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Success/error alerts */}
      {(singleImportMutation.isSuccess || batchImportMutation.isSuccess || enrichMutation.isSuccess) && (
        <Alert className="bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Success</AlertTitle>
          <AlertDescription className="text-green-700">
            {singleImportMutation.isSuccess && "Study added successfully."}
            {batchImportMutation.isSuccess && batchImportMutation.data && 
              `Added ${batchImportMutation.data.imported} studies. ${batchImportMutation.data.enriched || 0} were enriched with PubMed data.`}
            {enrichMutation.isSuccess && enrichMutation.data && 
              `Enriched ${enrichMutation.data.enriched || 0} existing studies with data from PubMed.`}
          </AlertDescription>
        </Alert>
      )}
      
      {(singleImportMutation.isError || batchImportMutation.isError || enrichMutation.isError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {singleImportMutation.error instanceof Error && singleImportMutation.error.message}
            {batchImportMutation.error instanceof Error && batchImportMutation.error.message}
            {enrichMutation.error instanceof Error && enrichMutation.error.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default SimpleImportForm;