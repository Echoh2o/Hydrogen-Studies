import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import AdminLayout from "@/components/admin/AdminLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DeletedStudy {
  id: number;
  originalStudyId: number;
  title: string;
  doi: string | null;
  authors: string | null;
  journal: string | null;
  publishYear: number | null;
  deletedBy: string | null;
  reason: string | null;
  deletedAt: string;
}

export default function DeletionLedgerPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const pageSize = 20;

  const ledgerQuery = useQuery<{
    data: DeletedStudy[];
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  }>({
    queryKey: ["/api/studies/deleted-ledger", { page, pageSize }],
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/studies/deleted-ledger/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies/deleted-ledger"] });
      toast({ title: "Study unblocked", description: "This study can now be re-imported." });
    },
    onError: (error: Error) => {
      toast({ title: "Restore failed", description: error.message, variant: "destructive" });
    },
  });

  const bulkRestoreMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", "/api/studies/deleted-ledger/bulk-remove", { ids });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studies/deleted-ledger"] });
      toast({ title: "Studies unblocked", description: `${data.removed} studies can now be re-imported.` });
      setSelectedIds(new Set());
    },
    onError: (error: Error) => {
      toast({ title: "Bulk restore failed", description: error.message, variant: "destructive" });
    },
  });

  const entries = ledgerQuery.data?.data || [];
  const totalPages = ledgerQuery.data?.pageCount || 1;
  const total = ledgerQuery.data?.total || 0;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <AdminLayout
      title="Deleted Studies"
      description="Studies that have been deleted and are blocked from re-import"
    >
      <Helmet>
        <title>Deleted Studies | HydrogenStudies Admin</title>
      </Helmet>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <CardTitle>Deletion Ledger</CardTitle>
              <CardDescription>
                {total} deleted {total === 1 ? "study" : "studies"} — these are blocked from re-import. Restore to allow re-importing.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-muted rounded-md">
              <Badge variant="secondary">{selectedIds.size} selected</Badge>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Deselect All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkRestoreMutation.mutate(Array.from(selectedIds))}
                disabled={bulkRestoreMutation.isPending}
              >
                {bulkRestoreMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Restore Selected
              </Button>
            </div>
          )}

          {ledgerQuery.isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : ledgerQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>Failed to load deletion ledger.</AlertDescription>
            </Alert>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trash2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No deleted studies in the ledger.</p>
              <p className="text-xs mt-1">Studies you delete will appear here.</p>
            </div>
          ) : (
            <>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={entries.length > 0 && selectedIds.size === entries.length}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead className="w-[300px]">Study</TableHead>
                      <TableHead>DOI</TableHead>
                      <TableHead>Deleted By</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Deleted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(entry.id)}
                            onCheckedChange={() => toggleSelect(entry.id)}
                            aria-label={`Select ${entry.title}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[300px]">
                            <p className="font-medium text-sm truncate">{entry.title}</p>
                            {entry.journal && (
                              <p className="text-xs text-muted-foreground truncate">{entry.journal}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono">{entry.doi || "—"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{entry.deletedBy || "—"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground max-w-[150px] truncate block">
                            {entry.reason || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{formatDate(entry.deletedAt)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => restoreMutation.mutate(entry.id)}
                            disabled={restoreMutation.isPending}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restore
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({total} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
