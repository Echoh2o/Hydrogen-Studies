/**
 * /admin/evidence-review — TRUST-BADGE-PLAN Phase 0.8. Extracted evidence
 * fields are approved by default; the reviewer unapproves or corrects here.
 * Unapproved values drop out of every public number on the next render.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import AdminLayout from "@/components/admin/AdminLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EDITABLE_EVIDENCE_FIELDS } from "@shared/evidence-fields";

interface Row {
  id: number;
  slug: string;
  title: string;
  publish_year: number | null;
  primary_outcome: string | null;
  effect_direction: string;
  effect_direction_evidence: string | null;
  h2_concentration_ppm: string | null;
  h2_concentration_raw: string | null;
  delivery_route: string | null;
  population_kind: string | null;
  population_condition: string | null;
  evidence_fields_status: "auto_approved" | "approved" | "unapproved";
  evidence_fields_reviewed_by: string | null;
}
interface ListResponse { rows: Row[]; counts: Record<string, number>; pageSize: number; offset: number }

const STATUS_LABEL: Record<string, string> = { auto_approved: "Auto-approved", approved: "Approved", unapproved: "Unapproved" };
const DIRECTION_LABEL: Record<string, string> = { improved: "Improved", no_clear_effect: "No clear effect", worsened: "Worsened", mixed: "Mixed", not_reported: "Not reported" };

export default function EvidenceReviewPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState("auto_approved");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const key = `/api/admin/evidence-fields?status=${status}&q=${encodeURIComponent(q)}&offset=${offset}`;
  const { data, isLoading } = useQuery<ListResponse>({ queryKey: [key] });

  const refresh = () => queryClient.invalidateQueries({ predicate: (qq) => String(qq.queryKey[0]).startsWith("/api/admin/evidence-fields") });
  const act = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "approve" | "unapprove" }) => apiRequest("POST", `/api/admin/evidence-fields/${id}/${action}`),
    onSuccess: (_d, v) => { toast({ title: v.action === "approve" ? "Approved" : "Unapproved — removed from public numbers" }); refresh(); },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });
  const correct = useMutation({
    mutationFn: async ({ id, effect_direction }: { id: number; effect_direction: string }) => apiRequest("PATCH", `/api/admin/evidence-fields/${id}`, { effect_direction }),
    onSuccess: () => { toast({ title: "Corrected and approved" }); refresh(); },
    onError: () => toast({ title: "Correction failed", variant: "destructive" }),
  });

  const counts = data?.counts ?? {};
  return (
    <AdminLayout title="Evidence review">
      <Helmet><title>Evidence review | Admin</title></Helmet>
      <Card>
        <CardHeader>
          <CardTitle>Evidence review</CardTitle>
          <CardDescription>
            Fields extracted from each study's abstract are approved by default. Unapprove anything wrong, or correct the outcome
            direction. Changes appear in the public numbers (limits page, null results, gap map, dataset) on the next page load.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={status} onValueChange={(v) => { setStatus(v); setOffset(0); }}>
              <TabsList>
                {Object.entries(STATUS_LABEL).map(([k, label]) => (
                  <TabsTrigger key={k} value={k}>{label} ({counts[k] ?? 0})</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Input placeholder="Search title or outcome" value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} className="max-w-xs" />
          </div>
          {isLoading ? <p className="text-sm text-gray-500">Loading…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Study</TableHead>
                  <TableHead>Primary outcome</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Based on</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.rows ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-xs align-top">
                      <a href={`/study/${r.slug}`} target="_blank" rel="noopener" className="font-medium text-teal-700 underline">{r.title}</a>
                      <div className="text-xs text-gray-500">{r.publish_year ?? ""} · #{r.id}</div>
                    </TableCell>
                    <TableCell className="max-w-[14rem] align-top text-sm">{r.primary_outcome ?? "—"}</TableCell>
                    <TableCell className="align-top">
                      <select
                        aria-label="Outcome direction"
                        className="rounded border px-2 py-1 text-sm"
                        value={r.effect_direction}
                        onChange={(e) => correct.mutate({ id: r.id, effect_direction: e.target.value })}
                      >
                        {EDITABLE_EVIDENCE_FIELDS.effect_direction.map((d) => <option key={d} value={d}>{DIRECTION_LABEL[d] ?? d}</option>)}
                      </select>
                    </TableCell>
                    <TableCell className="max-w-sm align-top text-xs italic text-gray-600">{r.effect_direction_evidence ? `“${r.effect_direction_evidence}”` : "—"}</TableCell>
                    <TableCell className="align-top text-xs text-gray-600">
                      {[r.delivery_route, r.population_kind === "patients" ? r.population_condition : r.population_kind, r.h2_concentration_ppm ? `${Number(r.h2_concentration_ppm)} ppm` : r.h2_concentration_raw].filter(Boolean).join(" · ")}
                      <div><Badge variant="outline" className="mt-1">{STATUS_LABEL[r.evidence_fields_status]}</Badge></div>
                    </TableCell>
                    <TableCell className="space-y-1 align-top">
                      {r.evidence_fields_status !== "approved" && <Button size="sm" variant="outline" onClick={() => act.mutate({ id: r.id, action: "approve" })}>Approve</Button>}
                      {r.evidence_fields_status !== "unapproved" && <Button size="sm" variant="destructive" onClick={() => act.mutate({ id: r.id, action: "unapprove" })}>Unapprove</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - (data?.pageSize ?? 50)))}>Previous</Button>
            <Button variant="outline" size="sm" disabled={(data?.rows.length ?? 0) < (data?.pageSize ?? 50)} onClick={() => setOffset(offset + (data?.pageSize ?? 50))}>Next</Button>
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
