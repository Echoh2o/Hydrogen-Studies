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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Clock, Edit, Loader2, Trash } from "lucide-react";
import KeywordEditor from "./KeywordEditor";
import type { Keyword } from "./types";

interface KeywordsTableProps {
  isLoading: boolean;
  isError: boolean;
  filteredKeywords: Keyword[];
  totalCount: number;
  editingKeyword: Keyword | null;
  setEditingKeyword: (k: Keyword | null) => void;
  handleToggleKeywordActive: (id: number, isActive: boolean) => void;
  handleDeleteKeyword: (id: number) => void;
}

export function KeywordsTable({
  isLoading,
  isError,
  filteredKeywords,
  totalCount,
  editingKeyword,
  setEditingKeyword,
  handleToggleKeywordActive,
  handleDeleteKeyword,
}: KeywordsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monitored Keywords</CardTitle>
        <CardDescription>
          Keywords to search for in medical research databases
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
            <p>Failed to load keywords. Please try again.</p>
          </div>
        ) : filteredKeywords.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p>No keywords found. Add some to start monitoring.</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Term</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Search</TableHead>
                  <TableHead>Matches</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKeywords.map((keyword) => (
                  <TableRow key={keyword.id}>
                    {editingKeyword && editingKeyword.id === keyword.id ? (
                      <TableCell colSpan={6}>
                        <KeywordEditor
                          keyword={keyword}
                          onCancel={() => setEditingKeyword(null)}
                        />
                      </TableCell>
                    ) : (
                      <>
                        <TableCell>{keyword.term}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{keyword.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={keyword.isActive}
                              onCheckedChange={() =>
                                handleToggleKeywordActive(
                                  keyword.id,
                                  !keyword.isActive,
                                )
                              }
                            />
                            <span>
                              {keyword.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {keyword.lastSearched ? (
                            <span className="flex items-center text-sm">
                              <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                              {new Date(
                                keyword.lastSearched,
                              ).toLocaleDateString()}
                            </span>
                          ) : (
                            "Never"
                          )}
                        </TableCell>
                        <TableCell>
                          {typeof keyword.matchCount === "number" ? (
                            <Badge
                              variant={
                                keyword.matchCount > 0 ? "default" : "outline"
                              }
                            >
                              {keyword.matchCount}{" "}
                              {keyword.matchCount === 1 ? "match" : "matches"}
                            </Badge>
                          ) : (
                            "0"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingKeyword(keyword)}
                              title="Edit keyword"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteKeyword(keyword.id)}
                              title="Delete keyword"
                            >
                              <Trash className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-xs text-muted-foreground">
          {totalCount} total keywords
        </div>
      </CardFooter>
    </Card>
  );
}
