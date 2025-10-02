import React from "react";
import { Helmet } from "react-helmet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import EuropePmcSearch from "@/components/admin/EuropePmcSearch";

export default function EuropePmcPage() {
  return (
    <>
      <Helmet>
        <title>Europe PMC Search - Hydrogen Studies</title>
      </Helmet>

      <div className="bg-neutral-100 py-8 min-h-screen">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Europe PMC Search</h1>
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>

          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle>Europe PMC Literature Database</CardTitle>
              <CardDescription>
                Search over 40 million publications in Europe PMC, a
                comprehensive repository of biomedical research
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Europe PMC is a repository of life science publications that
                includes:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-4">
                <li>All PubMed content</li>
                <li>Full text articles from PubMed Central</li>
                <li>Patents from the European Patent Office</li>
                <li>Clinical guidelines and other biomedical literature</li>
                <li>Preprints from bioRxiv and medRxiv</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Use this tool to discover hydrogen research and save it directly
                to your database.
              </p>
            </CardContent>
          </Card>

          <EuropePmcSearch />
        </div>
      </div>
    </>
  );
}
