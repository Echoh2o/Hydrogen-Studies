import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileSpreadsheet } from "lucide-react";

interface MinimalStudyImport {
  title?: string;
  identifier?: string; // This can be URL, DOI, or PMID
  autoEnrich: boolean;
}

const MinimalImportForm = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<MinimalStudyImport>({
    title: '',
    identifier: '',
    autoEnrich: true
  });
  const [batchData, setBatchData] = useState<string>('');

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle checkbox changes
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  // Mutation for single study import
  const singleImportMutation = useMutation({
    mutationFn: async (data: MinimalStudyImport) => {
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
      
      return response.json();
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

  // Mutation for batch import
  const batchImportMutation = useMutation({
    mutationFn: async (data: string) => {
      const response = await fetch('/api/import/minimal-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data, autoEnrich: formData.autoEnrich })
      });
      
      if (!response.ok) {
        throw new Error(`Batch import failed: ${response.statusText}`);
      }
      
      return response.json();
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
    
    batchImportMutation.mutate(batchData);
  };

  // Run PubMed enrichment for existing studies
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
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Enrichment Successful",
        description: `Enriched ${data.count} studies with data from PubMed.`,
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
      <Card>
        <CardHeader>
          <CardTitle>Quick Study Import</CardTitle>
          <CardDescription>
            Add a single study with minimal information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSingleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Study Title</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter study title"
              />
              <p className="text-sm text-muted-foreground">
                Enter the study title, or leave blank if providing an identifier
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="identifier">URL, DOI, or PMID</Label>
              <Input
                id="identifier"
                name="identifier"
                value={formData.identifier}
                onChange={handleInputChange}
                placeholder="https://pubmed.ncbi.nlm.nih.gov/12345678/ or 12345678"
              />
              <p className="text-sm text-muted-foreground">
                Enter a PubMed URL, DOI, or PMID
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoEnrich"
                name="autoEnrich"
                checked={formData.autoEnrich}
                onChange={handleCheckboxChange}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="autoEnrich" className="font-normal text-sm">
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
                <>Add Study</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Batch Import</CardTitle>
          <CardDescription>
            Import multiple studies at once
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
              <p className="text-sm text-muted-foreground">
                Enter each study on a new line - can be titles, PubMed IDs, DOIs, or URLs
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="batchAutoEnrich"
                name="autoEnrich"
                checked={formData.autoEnrich}
                onChange={handleCheckboxChange}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="batchAutoEnrich" className="font-normal text-sm">
                Automatically fetch full details from PubMed for all imported studies
              </Label>
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
      
      {(singleImportMutation.isError || batchImportMutation.isError || enrichMutation.isError) && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {singleImportMutation.error instanceof Error && singleImportMutation.error.message}
            {batchImportMutation.error instanceof Error && batchImportMutation.error.message}
            {enrichMutation.error instanceof Error && enrichMutation.error.message}
          </AlertDescription>
        </Alert>
      )}
      
      {(singleImportMutation.isSuccess || batchImportMutation.isSuccess || enrichMutation.isSuccess) && (
        <Alert className="bg-green-50 border-green-500">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>
            {singleImportMutation.isSuccess && "Study added successfully."}
            {batchImportMutation.isSuccess && batchImportMutation.data && 
              `Added ${batchImportMutation.data.imported} studies. ${batchImportMutation.data.enriched || 0} were enriched with PubMed data.`}
            {enrichMutation.isSuccess && enrichMutation.data && 
              `Enriched ${enrichMutation.data.count} existing studies with data from PubMed.`}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default MinimalImportForm;