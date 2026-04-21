import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Edit, Loader2, Trash } from "lucide-react";
import type { ExcludedKeyword } from "./types";

interface ExcludedTermsTableProps {
  isLoading: boolean;
  isError: boolean;
  excludedKeywords: ExcludedKeyword[];
  searchTerm: string;
  setEditingExcluded: (k: ExcludedKeyword | null) => void;
}

export function ExcludedTermsTable({
  isLoading,
  isError,
  excludedKeywords,
  searchTerm,
  setEditingExcluded,
}: ExcludedTermsTableProps) {
  const filtered = excludedKeywords.filter(
    (keyword) =>
      searchTerm === "" ||
      keyword.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      keyword.reason.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Excluded Terms</CardTitle>
        <CardDescription>
          Terms that will exclude studies from search results
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="text-center py-10 text-destructive">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load excluded terms. Please try again.</p>
          </div>
        ) : excludedKeywords.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p>
              No excluded terms found. Add some to filter out irrelevant
              results.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Term</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((keyword) => (
                  <TableRow key={keyword.id}>
                    <TableCell>{keyword.term}</TableCell>
                    <TableCell>{keyword.reason}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingExcluded(keyword)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            /* Handle delete */
                          }}
                        >
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-xs text-muted-foreground">
          {excludedKeywords.length} total excluded terms
        </div>
      </CardFooter>
    </Card>
  );
}
