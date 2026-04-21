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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  PlayCircle,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { formatAuthors } from "@/lib/utils";
import type { MonitorResult } from "./types";

interface MonitorResultsTableProps {
  isLoading: boolean;
  isError: boolean;
  filteredResults: MonitorResult[];
  totalCount: number;
  selectedResults: number[];
  setSelectedResults: (ids: number[]) => void;
  toggleResultSelection: (id: number) => void;
  handleUpdateResultStatus: (id: number, status: string) => void;
  setActiveTab: (tab: string) => void;
}

export function MonitorResultsTable({
  isLoading,
  isError,
  filteredResults,
  totalCount,
  selectedResults,
  setSelectedResults,
  toggleResultSelection,
  handleUpdateResultStatus,
  setActiveTab,
}: MonitorResultsTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Monitor Results</CardTitle>
          <CardDescription>
            Studies found by the keyword monitor
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({
              queryKey: ["/api/keywords/results"],
            });
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Results
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="text-center py-10 text-destructive">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load monitor results. Please try again.</p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="py-10">
            <div className="text-center py-6 border rounded-md bg-muted/30">
              <div className="mb-4">
                <Search className="h-12 w-12 mx-auto text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No results found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                No matches have been found for your keywords yet. You can
                trigger a new search from the Monitor tab or wait for the
                scheduled search to run automatically.
              </p>
              <div className="mt-4">
                <Button onClick={() => setActiveTab("monitor")}>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Go to Monitor Settings
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        filteredResults.length > 0 &&
                        selectedResults.length === filteredResults.length
                      }
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedResults(filteredResults.map((r) => r.id));
                        } else {
                          setSelectedResults([]);
                        }
                      }}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Matched Keywords</TableHead>
                  <TableHead>Found</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedResults.includes(result.id)}
                        onCheckedChange={() => toggleResultSelection(result.id)}
                        aria-label={`Select result ${result.id}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      <div>
                        <div className="font-medium">{result.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {formatAuthors(result.authors)} | {result.journal}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{result.source}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {result.matchedKeywords.map((keyword) => (
                          <Badge key={keyword} variant="outline">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{result.foundAt}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          result.status === "approved"
                            ? "default"
                            : result.status === "rejected"
                              ? "destructive"
                              : result.status === "archived"
                                ? "outline"
                                : "secondary"
                        }
                      >
                        {result.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleUpdateResultStatus(result.id, "approved")
                          }
                          disabled={result.status === "approved"}
                        >
                          <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleUpdateResultStatus(result.id, "rejected")
                          }
                          disabled={result.status === "rejected"}
                        >
                          <XCircle className="h-4 w-4 mr-1 text-red-500" />
                          Reject
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
          {totalCount} total results
        </div>
      </CardFooter>
    </Card>
  );
}
