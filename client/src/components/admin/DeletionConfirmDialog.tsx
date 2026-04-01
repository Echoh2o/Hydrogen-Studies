import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface DeletionConfirmDialogProps {
  mode: "single" | "bulk";
  studyId?: number;
  studyIds?: number[];
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  isDeleting: boolean;
}

const LABEL_MAP: Record<string, string> = {
  seoMetadata: "SEO Metadata",
  contentAnalytics: "Analytics Records",
  userEngagement: "Engagement Records",
  contentInsights: "Content Insights",
  contentVersions: "Content Versions",
  contentRelationships: "Content Relationships",
  smartLinks: "Smart Links",
  updateNotifications: "Update Notifications",
  updateHistory: "Update History",
  contentDependencies: "Content Dependencies",
};

export function DeletionConfirmDialog({
  mode,
  studyId,
  studyIds,
  open,
  onClose,
  onConfirm,
  isDeleting,
}: DeletionConfirmDialogProps) {
  const [reason, setReason] = useState("");

  const previewQuery = useQuery<{
    studyId: number;
    studyTitle: string;
    relatedCounts: Record<string, number>;
    totalRelatedRecords: number;
  }>({
    queryKey: [`/api/studies/${studyId}/deletion-preview`],
    enabled: open && mode === "single" && !!studyId,
  });

  const preview = previewQuery.data;
  const nonZeroCounts = preview
    ? Object.entries(preview.relatedCounts).filter(([, v]) => v > 0)
    : [];

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {mode === "single" ? "Delete Study" : "Delete Studies"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {mode === "single" ? (
                previewQuery.isLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading impact preview...
                  </div>
                ) : preview ? (
                  <>
                    <p>
                      You are about to delete{" "}
                      <strong>{preview.studyTitle}</strong>.
                    </p>
                    {nonZeroCounts.length > 0 && (
                      <div className="rounded-md border p-3 space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          Related records that will also be removed:
                        </p>
                        <ul className="text-sm space-y-1">
                          {nonZeroCounts.map(([key, val]) => (
                            <li key={key} className="flex justify-between">
                              <span>{LABEL_MAP[key] || key}</span>
                              <Badge variant="secondary">{val}</Badge>
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-muted-foreground pt-1">
                          Total: {preview.totalRelatedRecords} related records
                          + cascading FK deletions
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p>Are you sure you want to delete this study?</p>
                )
              ) : (
                <p>
                  You are about to delete{" "}
                  <strong>{studyIds?.length ?? 0} studies</strong> and all their
                  related content.
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="deletion-reason" className="text-sm font-medium text-foreground">
                  Reason for deletion (optional)
                </Label>
                <Textarea
                  id="deletion-reason"
                  placeholder="e.g., Duplicate entry, Retracted study, Not relevant to H2 research..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>

              <p className="text-destructive font-medium text-sm">
                This action cannot be undone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting} onClick={handleClose}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reason || undefined)}
            disabled={isDeleting || (mode === "single" && previewQuery.isLoading)}
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isDeleting
              ? "Deleting..."
              : mode === "single"
                ? "Delete Study"
                : `Delete ${studyIds?.length ?? 0} Studies`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
