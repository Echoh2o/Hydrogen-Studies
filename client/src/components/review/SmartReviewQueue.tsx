import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  TrendingUp,
  Brain,
  Star,
  Calendar,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Sparkles,
  Copy,
  Inbox,
  Library,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth/ProtectedRoute";
import StudyPreviewAssistant from "./StudyPreviewAssistant";

// ── Types ───────────────────────────────────────────────────

interface QualityScore {
  overall: number;
  methodology: number;
  impact: number;
  relevance: number;
  redFlags: string[];
  redFlagCount: number;
  confidence?: "low" | "medium" | "high" | null;
  rubricVersion?: string | null;
  /** Per-component sub-scores (0-100). Null if this is a legacy score row. */
  componentScores?: {
    sampleSize: number | null;
    studyDesign: number | null;
    blinding: number | null;
    controlGroup: number | null;
    statisticalRigor: number | null;
    journalImpact: number | null;
    citations: number | null;
    authorReputation: number | null;
    institution: number | null;
    fundingQuality: number | null;
    hydrogenFocus: number | null;
    humanStudy: number | null;
    clinicalApplicability: number | null;
    recency: number | null;
    practicalImplications: number | null;
  } | null;
}

interface Recommendation {
  priority: "high" | "medium" | "low";
  suggestedActions: string[];
  keyFindings: string[];
  suggestedCategories: string[];
}

/** Post-publish study (from /api/review-assistant/queue) */
interface StudyQueueItem {
  id: number;
  title: string;
  authors: string;
  journal: string;
  publishDate: string;
  category: string;
  scores: QualityScore | null;
  recommendations: Recommendation | null;
}

/** Pre-publish queue item (from /api/research/review-queue) — scored on insert */
interface PendingQueueItem {
  id: number;
  externalId: string;
  doi: string | null;
  title: string;
  abstract: string;
  authors: string;
  journal: string;
  publishDate: string | null;
  category: string;
  sourcePlatform: string;
  status: "pending" | "approved" | "rejected";
  overallScore: number | null;
  methodologyScore: number | null;
  impactScore: number | null;
  relevanceScore: number | null;
  redFlags: string[] | null;
  redFlagCount: number | null;
  scoreBreakdown: any | null; // JSONB from DB — nested component breakdown
  scoreConfidence: "low" | "medium" | "high" | null;
  scoredAt: string | null;
  rubricVersion: string | null;
  savedAt: string;
  isDuplicate: boolean | null;
  duplicateOfStudyId: number | null;
  /** JSON text — the dedup service stores match metadata under `duplicateMatch` */
  reviewNotes: string | null;
}

interface DuplicateMatch {
  matchType: "doi" | "title";
  similarity: number;
  existingTitle: string | null;
  duplicateOfStudyId: number | null;
  duplicateOfQueueId: number | null;
}

/** Parse `duplicateMatch` metadata out of a queue item's reviewNotes blob. */
function extractDuplicateMatch(
  item: PendingQueueItem,
): DuplicateMatch | null {
  if (!item.isDuplicate) return null;
  try {
    const parsed = JSON.parse(item.reviewNotes || "{}");
    const dm = parsed?.duplicateMatch;
    if (!dm) return null;
    return {
      matchType: dm.matchType,
      similarity: Number(dm.similarity) || 0,
      existingTitle: dm.existingTitle ?? null,
      duplicateOfStudyId:
        dm.duplicateOfStudyId ?? item.duplicateOfStudyId ?? null,
      duplicateOfQueueId: dm.duplicateOfQueueId ?? null,
    };
  } catch {
    return null;
  }
}

// ── Helpers ─────────────────────────────────────────────────

function scoreTier(score: number | null | undefined) {
  if (score == null) return "unscored";
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  if (score >= 40) return "borderline";
  return "low";
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) {
    return (
      <Badge variant="secondary" className="text-xs">
        Unscored
      </Badge>
    );
  }
  const tier = scoreTier(score);
  const cls =
    tier === "high"
      ? "bg-green-500 text-white"
      : tier === "medium"
      ? "bg-yellow-500 text-white"
      : tier === "borderline"
      ? "bg-orange-500 text-white"
      : "bg-red-500 text-white";
  return <Badge className={cn(cls)}>Overall: {score}</Badge>;
}

function ConfidenceBadge({
  confidence,
}: {
  confidence: "low" | "medium" | "high" | null | undefined;
}) {
  if (!confidence) return null;
  const label =
    confidence === "high"
      ? "High confidence"
      : confidence === "medium"
      ? "Medium confidence"
      : "Low confidence (abstract only)";
  const cls =
    confidence === "high"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : confidence === "medium"
      ? "bg-sky-100 text-sky-800 border-sky-200"
      : "bg-muted text-muted-foreground";
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium", cls)}
      title={
        confidence === "low"
          ? "Score is based on abstract only. More accurate scoring happens after the study is published and enriched with methods/results."
          : undefined
      }
    >
      {label}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const cls =
    priority === "high"
      ? "bg-teal-500"
      : priority === "medium"
      ? "bg-yellow-500"
      : "bg-gray-500";
  return (
    <Badge className={cn("text-white", cls)}>
      {priority.toUpperCase()} Priority
    </Badge>
  );
}

function ComponentScoreRow({
  scores,
}: {
  scores: {
    methodology: number;
    impact: number;
    relevance: number;
    redFlagCount: number;
  };
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      <Badge variant="outline" className="text-xs">
        <Brain className="h-3 w-3 mr-1" />
        Method: {scores.methodology}
      </Badge>
      <Badge variant="outline" className="text-xs">
        <TrendingUp className="h-3 w-3 mr-1" />
        Impact: {scores.impact}
      </Badge>
      <Badge variant="outline" className="text-xs">
        <Star className="h-3 w-3 mr-1" />
        Relevance: {scores.relevance}
      </Badge>
      {scores.redFlagCount > 0 && (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {scores.redFlagCount} Red Flag{scores.redFlagCount !== 1 ? "s" : ""}
        </Badge>
      )}
    </div>
  );
}

function RedFlagList({ flags }: { flags: string[] }) {
  if (!flags || flags.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-destructive/20 bg-destructive/5 -mx-6 px-6 py-2">
      <p className="text-xs font-medium text-destructive mb-1 flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Red flags
      </p>
      <ul className="text-xs text-destructive/90 list-disc list-inside space-y-0.5">
        {flags.slice(0, 4).map((f, i) => (
          <li key={i} className="line-clamp-1" title={f}>
            {f}
          </li>
        ))}
        {flags.length > 4 && (
          <li className="text-muted-foreground">+{flags.length - 4} more</li>
        )}
      </ul>
    </div>
  );
}

/**
 * Maps a 0-100 sub-score to a colored dot + number, so a row of 15 scores
 * is scannable. Red for <50, amber for <70, green otherwise.
 */
function SubScoreCell({
  label,
  score,
}: {
  label: string;
  score: number | null | undefined;
}) {
  if (score == null) {
    return (
      <div className="flex items-center justify-between py-0.5 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">—</span>
      </div>
    );
  }
  const cls =
    score >= 70
      ? "text-green-700"
      : score >= 50
      ? "text-amber-700"
      : "text-red-700";
  return (
    <div className="flex items-center justify-between py-0.5 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums font-medium", cls)}>{score}</span>
    </div>
  );
}

/**
 * Expandable score-breakdown panel. Renders three columns (Methodology,
 * Impact, Relevance) with their sub-scores stacked. Separate `breakdown`
 * prop is accepted for cases where per-component sub-scores aren't
 * persisted (the parsed JSON breakdown has the same data).
 */
function ScoreBreakdownPanel({
  component,
  weights = { methodology: 40, impact: 30, relevance: 30 },
}: {
  component: QualityScore["componentScores"];
  weights?: { methodology: number; impact: number; relevance: number };
}) {
  if (!component) {
    return (
      <p className="text-xs text-muted-foreground">
        Component breakdown not available for this score (legacy row).
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
      <div>
        <p className="font-medium mb-1 flex items-center gap-1">
          <Brain className="h-3 w-3" />
          Methodology{" "}
          <span className="text-[10px] text-muted-foreground">({weights.methodology}%)</span>
        </p>
        <SubScoreCell label="Sample size" score={component.sampleSize} />
        <SubScoreCell label="Study design" score={component.studyDesign} />
        <SubScoreCell label="Blinding" score={component.blinding} />
        <SubScoreCell label="Control group" score={component.controlGroup} />
        <SubScoreCell label="Statistical rigor" score={component.statisticalRigor} />
      </div>
      <div>
        <p className="font-medium mb-1 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Impact{" "}
          <span className="text-[10px] text-muted-foreground">({weights.impact}%)</span>
        </p>
        <SubScoreCell label="Journal impact" score={component.journalImpact} />
        <SubScoreCell label="Citations" score={component.citations} />
        <SubScoreCell label="Author reputation" score={component.authorReputation} />
        <SubScoreCell label="Institution" score={component.institution} />
        <SubScoreCell label="Funding quality" score={component.fundingQuality} />
      </div>
      <div>
        <p className="font-medium mb-1 flex items-center gap-1">
          <Star className="h-3 w-3" />
          Relevance{" "}
          <span className="text-[10px] text-muted-foreground">({weights.relevance}%)</span>
        </p>
        <SubScoreCell label="Hydrogen focus" score={component.hydrogenFocus} />
        <SubScoreCell label="Human study" score={component.humanStudy} />
        <SubScoreCell label="Clinical applicability" score={component.clinicalApplicability} />
        <SubScoreCell label="Recency" score={component.recency} />
        <SubScoreCell label="Practical implications" score={component.practicalImplications} />
      </div>
    </div>
  );
}

/**
 * Builds a `componentScores` object from a parsed JSONB breakdown so the
 * same ScoreBreakdownPanel can render queue-item scores (which only store
 * the nested JSON, not the flat column set).
 */
function componentScoresFromBreakdown(
  breakdown: any,
): QualityScore["componentScores"] {
  if (!breakdown) return null;
  const parsed =
    typeof breakdown === "string" ? safeJSONParse(breakdown) : breakdown;
  if (!parsed) return null;
  const m = parsed.methodology?.components ?? {};
  const i = parsed.impact?.components ?? {};
  const r = parsed.relevance?.components ?? {};
  return {
    sampleSize: m.sampleSize ?? null,
    studyDesign: m.studyDesign ?? null,
    blinding: m.blinding ?? null,
    controlGroup: m.controlGroup ?? null,
    statisticalRigor: m.statisticalRigor ?? null,
    journalImpact: i.journalImpact ?? null,
    citations: i.citations ?? null,
    authorReputation: i.authorReputation ?? null,
    institution: i.institution ?? null,
    fundingQuality: i.fundingQuality ?? null,
    hydrogenFocus: r.hydrogenFocus ?? null,
    humanStudy: r.humanStudy ?? null,
    clinicalApplicability: r.clinicalApplicability ?? null,
    recency: r.recency ?? null,
    practicalImplications: r.practicalImplications ?? null,
  };
}

function safeJSONParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Compact topic-balance strip for the Pending Import tab. Shows the mix of
 * categories in the queue so curators can spot over-concentration ("32
 * pending: 18 cardio, 8 metabolic — where's the metabolic gap?") and
 * approve with portfolio balance in mind.
 */
function TopicBalance({ items }: { items: PendingQueueItem[] }) {
  if (items.length === 0) return null;
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = (item.category || "Uncategorized").trim() || "Uncategorized";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] ?? 1;
  // Highlight over-concentration: a single category >50% of queue is a flag
  const topShare = sorted[0] ? sorted[0][1] / items.length : 0;
  const skewed = topShare > 0.5 && items.length >= 4;

  return (
    <div className="mb-4 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium">
          Pending by category{" "}
          <span className="text-muted-foreground font-normal">
            · {items.length} total
          </span>
        </p>
        {skewed && (
          <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700">
            {Math.round(topShare * 100)}% is {sorted[0][0]}
          </Badge>
        )}
      </div>
      <div className="space-y-1">
        {sorted.slice(0, 6).map(([cat, n]) => (
          <div key={cat} className="flex items-center gap-2 text-[11px]">
            <div className="w-20 truncate" title={cat}>
              {cat}
            </div>
            <div className="flex-1 bg-muted rounded-sm h-1.5 overflow-hidden">
              <div
                className="bg-primary/70 h-full"
                style={{ width: `${(n / max) * 100}%` }}
              />
            </div>
            <div className="w-6 text-right tabular-nums">{n}</div>
          </div>
        ))}
        {sorted.length > 6 && (
          <div className="text-[10px] text-muted-foreground pt-1">
            +{sorted.length - 6} more categor
            {sorted.length - 6 === 1 ? "y" : "ies"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────

const SmartReviewQueue = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"pending" | "published">("pending");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedStudy, setSelectedStudy] = useState<StudyQueueItem | null>(null);
  const [selectedStudies, setSelectedStudies] = useState<Set<number>>(new Set());
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  /** Set of card ids with their "Why this score?" panel expanded. Keys are
   *  prefixed "p-<queueId>" or "s-<studyId>" so pending and published ids
   *  don't collide. */
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Set<string>>(
    new Set(),
  );

  const toggleBreakdown = (key: string) => {
    setExpandedBreakdowns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Queries ──────────────────────────────────────────────

  /** Pending Import — pre-publish queue with scores baked in on insert */
  const pendingQuery = useQuery({
    queryKey: ["/api/research/review-queue", "pending"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        "/api/research/review-queue?status=pending",
      );
      return (await res.json()) as { success: boolean; data: PendingQueueItem[] };
    },
    enabled: activeTab === "pending",
    refetchInterval: 30000,
  });

  /** Published Studies — post-publish view (cron keeps scores current) */
  const publishedQuery = useQuery({
    queryKey: ["/api/review-assistant/queue", "scored", priorityFilter],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/review-assistant/queue?status=scored&priority=${priorityFilter}&limit=50`,
      );
      return (await res.json()) as any;
    },
    enabled: activeTab === "published",
    refetchInterval: 30000,
  });

  const { data: redFlaggedStudies } = useQuery({
    queryKey: ["/api/review-assistant/red-flags"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        "/api/review-assistant/red-flags?minRedFlags=1&limit=10",
      );
      return (await res.json()) as any;
    },
  });

  // ── Mutations ────────────────────────────────────────────

  const approveMutation = useMutation({
    mutationFn: async (queueId: number) => {
      const res = await apiRequest(
        "PUT",
        `/api/research/review-queue/${queueId}`,
        { status: "approved", userId: user?.id ?? "admin" },
      );
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Study approved and imported" });
      queryClient.invalidateQueries({
        queryKey: ["/api/research/review-queue", "pending"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/review-assistant/queue"],
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to approve",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ queueId, notes }: { queueId: number; notes?: string }) => {
      const res = await apiRequest(
        "PUT",
        `/api/research/review-queue/${queueId}`,
        { status: "rejected", userId: user?.id ?? "admin", notes },
      );
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Study rejected" });
      queryClient.invalidateQueries({
        queryKey: ["/api/research/review-queue", "pending"],
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to reject",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  const scoreQueueItemMutation = useMutation({
    mutationFn: async (queueId: number) => {
      const res = await apiRequest(
        "POST",
        `/api/review-assistant/score-queue/${queueId}`,
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/research/review-queue", "pending"],
      });
    },
  });

  const scoreStudyMutation = useMutation({
    mutationFn: async (studyId: number) => {
      const res = await apiRequest(
        "POST",
        `/api/review-assistant/score/${studyId}`,
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/review-assistant/queue"],
      });
    },
  });

  const batchScoreMutation = useMutation({
    mutationFn: async (studyIds: number[]) => {
      const res = await apiRequest(
        "POST",
        "/api/review-assistant/batch-score",
        { studyIds },
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/review-assistant/queue"],
      });
      setSelectedStudies(new Set());
    },
  });

  const refreshScores = async (studyId: number) => {
    setRefreshingId(studyId);
    try {
      await apiRequest("PUT", `/api/review-assistant/refresh/${studyId}`);
      await publishedQuery.refetch();
    } finally {
      setRefreshingId(null);
    }
  };

  const handleBatchScore = () => {
    if (selectedStudies.size > 0) {
      batchScoreMutation.mutate(Array.from(selectedStudies));
    }
  };

  const toggleStudySelection = (studyId: number) => {
    const next = new Set(selectedStudies);
    if (next.has(studyId)) next.delete(studyId);
    else next.add(studyId);
    setSelectedStudies(next);
  };

  // ── Renderers ────────────────────────────────────────────

  /** Pre-publish card — queue item with approve/reject/score actions */
  const renderPendingCard = (item: PendingQueueItem) => {
    const hasScore = item.overallScore != null;
    const scoreObj = hasScore
      ? {
          overall: item.overallScore!,
          methodology: item.methodologyScore ?? 0,
          impact: item.impactScore ?? 0,
          relevance: item.relevanceScore ?? 0,
          redFlags: item.redFlags ?? [],
          redFlagCount: item.redFlagCount ?? 0,
          confidence: item.scoreConfidence,
          rubricVersion: item.rubricVersion,
        }
      : null;
    const duplicateMatch = extractDuplicateMatch(item);

    return (
      <Card
        key={item.id}
        className={cn(
          "transition-all hover:shadow-lg",
          item.isDuplicate && "border-destructive/40",
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 mb-2">
                <CardTitle className="text-sm font-medium line-clamp-2">
                  {item.title}
                </CardTitle>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {item.authors.split(",").slice(0, 3).join(", ")}
                {item.authors.split(",").length > 3 && " et al."}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span className="truncate max-w-[220px]" title={item.journal}>
                  {item.journal}
                </span>
                {item.publishDate && (
                  <>
                    <span>•</span>
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(item.publishDate).getFullYear() || "—"}</span>
                  </>
                )}
                <span>•</span>
                <Badge variant="outline" className="text-[10px] h-4 px-1">
                  {item.sourcePlatform}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col gap-2 items-end shrink-0">
              {item.isDuplicate ? (
                <Badge variant="destructive" className="text-[10px]">
                  <Copy className="h-3 w-3 mr-1" />
                  Duplicate
                </Badge>
              ) : (
                <>
                  <ScoreBadge score={item.overallScore} />
                  <ConfidenceBadge confidence={item.scoreConfidence} />
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Dedup panel — surfaces match metadata + one-click reject.
              Renders above everything else so curators see the red flag
              before they look at the score. */}
          {item.isDuplicate && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-destructive" />
                <span className="text-sm font-semibold text-destructive">
                  Likely duplicate
                </span>
                {duplicateMatch && (
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    {duplicateMatch.matchType === "doi"
                      ? "Exact DOI match"
                      : `${Math.round(duplicateMatch.similarity * 100)}% title match`}
                  </Badge>
                )}
              </div>
              {duplicateMatch?.existingTitle && (
                <div className="text-xs">
                  <div className="text-muted-foreground mb-0.5">
                    {duplicateMatch.duplicateOfQueueId
                      ? "Matches pending queue item:"
                      : "Matches existing published study:"}
                  </div>
                  <div className="font-mono text-[11px] line-clamp-2" title={duplicateMatch.existingTitle}>
                    {duplicateMatch.existingTitle}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                {duplicateMatch?.duplicateOfStudyId != null && (
                  <a
                    /* Number() coerces any JSON round-trip weirdness to a clean
                       numeric id so a bad server value can't produce a malformed
                       URL like "/study/id/../admin". */
                    href={`/study/id/${Number(duplicateMatch.duplicateOfStudyId) || 0}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline text-muted-foreground hover:text-foreground"
                  >
                    View existing study →
                  </a>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  className="ml-auto h-7 text-xs"
                  onClick={() => {
                    const note = duplicateMatch
                      ? `Rejected as duplicate — ${duplicateMatch.matchType} match (${Math.round(
                          duplicateMatch.similarity * 100,
                        )}%)${
                          duplicateMatch.duplicateOfStudyId
                            ? `, study #${duplicateMatch.duplicateOfStudyId}`
                            : ""
                        }`
                      : "Rejected as duplicate";
                    rejectMutation.mutate({ queueId: item.id, notes: note });
                  }}
                  disabled={rejectMutation.isPending}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Reject as duplicate
                </Button>
              </div>
            </div>
          )}

          {scoreObj ? (
            <>
              <ComponentScoreRow scores={scoreObj} />
              <RedFlagList flags={scoreObj.redFlags} />
              {/* Why this score? — collapsible sub-score breakdown */}
              {(() => {
                const key = `p-${item.id}`;
                const expanded = expandedBreakdowns.has(key);
                return (
                  <div className="border-t pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBreakdown(key);
                      }}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      {expanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      Why this score?
                    </button>
                    {expanded && (
                      <div className="mt-2 p-3 bg-muted/40 rounded-md">
                        <ScoreBreakdownPanel
                          component={componentScoresFromBreakdown(
                            item.scoreBreakdown,
                          )}
                        />
                        <div className="mt-2 pt-2 border-t flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Info className="h-3 w-3" />
                          {item.scoreConfidence && (
                            <span>Confidence: {item.scoreConfidence}</span>
                          )}
                          {item.rubricVersion && (
                            <span>Rubric {item.rubricVersion}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              <p className="text-xs text-muted-foreground line-clamp-2">
                {item.abstract}
              </p>
            </>
          ) : item.isDuplicate ? (
            // Dedup intentionally skips scoring — don't nudge the admin to retry
            <p className="text-xs text-muted-foreground line-clamp-2">
              {item.abstract}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => scoreQueueItemMutation.mutate(item.id)}
                disabled={scoreQueueItemMutation.isPending}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Score Now
              </Button>
              <span className="text-xs text-muted-foreground">
                Scoring was skipped or failed on import — click to retry.
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              size="sm"
              onClick={() => approveMutation.mutate(item.id)}
              disabled={approveMutation.isPending}
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Approve & Import
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => rejectMutation.mutate({ queueId: item.id })}
              disabled={rejectMutation.isPending}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Reject
            </Button>
            {hasScore && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => scoreQueueItemMutation.mutate(item.id)}
                disabled={scoreQueueItemMutation.isPending}
                title="Re-score with latest rubric"
                className="ml-auto"
              >
                <RefreshCw
                  className={cn(
                    "h-3 w-3",
                    scoreQueueItemMutation.isPending && "animate-spin",
                  )}
                />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  /** Published-study card — score display + refresh */
  const renderPublishedCard = (study: StudyQueueItem) => (
    <Card
      key={study.id}
      className={cn(
        "cursor-pointer transition-all hover:shadow-lg",
        selectedStudy?.id === study.id && "ring-2 ring-primary",
        selectedStudies.has(study.id) && "bg-accent/50",
      )}
      onClick={() => setSelectedStudy(study)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={selectedStudies.has(study.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleStudySelection(study.id);
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4"
              />
              <CardTitle className="text-sm font-medium line-clamp-2">
                {study.title}
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {study.authors.split(",").slice(0, 3).join(", ")}
              {study.authors.split(",").length > 3 && " et al."}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate max-w-[220px]">{study.journal}</span>
              <span>•</span>
              <Calendar className="h-3 w-3" />
              <span>
                {study.publishDate
                  ? new Date(study.publishDate).getFullYear()
                  : "—"}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end shrink-0">
            {study.scores && <ScoreBadge score={study.scores.overall} />}
            {study.scores && (
              <ConfidenceBadge confidence={study.scores.confidence} />
            )}
            {study.recommendations && (
              <PriorityBadge priority={study.recommendations.priority} />
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                refreshScores(study.id);
              }}
              disabled={refreshingId === study.id}
            >
              <RefreshCw
                className={cn(
                  "h-3 w-3",
                  refreshingId === study.id && "animate-spin",
                )}
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {study.scores ? (
          <>
            <ComponentScoreRow scores={study.scores} />
            <RedFlagList flags={study.scores.redFlags} />
            {/* Why this score? — collapsible sub-score breakdown */}
            {(() => {
              const key = `s-${study.id}`;
              const expanded = expandedBreakdowns.has(key);
              return (
                <div className="border-t pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBreakdown(key);
                    }}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {expanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Why this score?
                  </button>
                  {expanded && (
                    <div className="mt-2 p-3 bg-muted/40 rounded-md">
                      <ScoreBreakdownPanel
                        component={study.scores.componentScores ?? null}
                      />
                      <div className="mt-2 pt-2 border-t flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Info className="h-3 w-3" />
                        {study.scores.confidence && (
                          <span>Confidence: {study.scores.confidence}</span>
                        )}
                        {study.scores.rubricVersion && (
                          <span>Rubric {study.scores.rubricVersion}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              scoreStudyMutation.mutate(study.id);
            }}
            disabled={scoreStudyMutation.isPending}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Generate Score
          </Button>
        )}
        {study.recommendations &&
          study.recommendations.keyFindings.length > 0 && (
            <div className="pt-3 border-t">
              <p className="text-xs font-medium mb-1">Key Findings:</p>
              <ul className="text-xs text-muted-foreground list-disc list-inside">
                {study.recommendations.keyFindings
                  .slice(0, 2)
                  .map((finding, idx) => (
                    <li key={idx} className="line-clamp-1">
                      {finding}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        {study.recommendations &&
          study.recommendations.suggestedActions.length > 0 && (
            <div className="pt-3 border-t">
              <p className="text-xs font-medium mb-1">Suggested Actions:</p>
              <div className="flex flex-wrap gap-1">
                {study.recommendations.suggestedActions
                  .slice(0, 3)
                  .map((action, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {action}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  );

  // ── Render ───────────────────────────────────────────────

  const pendingItems = pendingQuery.data?.data ?? [];
  const publishedData = publishedQuery.data;
  const publishedQueue: StudyQueueItem[] = publishedData?.queue ?? [];

  const pendingCount = pendingItems.length;

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Smart Review Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Score-first curation. Every item is auto-scored before you decide to
            publish it, and published studies are rescored nightly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "published" && (
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button
            onClick={() =>
              activeTab === "pending"
                ? pendingQuery.refetch()
                : publishedQuery.refetch()
            }
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b">
        <button
          onClick={() => setActiveTab("pending")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "pending"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Inbox className="h-4 w-4" />
          Pending Import
          {pendingCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {pendingCount}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab("published")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "published"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Library className="h-4 w-4" />
          Published Studies
        </button>
      </div>

      {/* Red flags alert */}
      {redFlaggedStudies?.studies?.length > 0 && activeTab === "published" && (
        <Alert className="mb-4 border-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{redFlaggedStudies.studies.length} published studies</strong>{" "}
            have red flags that need review.
          </AlertDescription>
        </Alert>
      )}

      {/* Batch operations */}
      {activeTab === "published" && selectedStudies.size > 0 && (
        <div className="mb-4 p-4 bg-accent rounded-lg flex items-center justify-between">
          <span className="text-sm">
            {selectedStudies.size}{" "}
            {selectedStudies.size === 1 ? "study" : "studies"} selected
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleBatchScore}
              disabled={batchScoreMutation.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Batch Re-score
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedStudies(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      <div
        className={cn(
          "grid grid-cols-1 gap-6",
          activeTab === "published" && "lg:grid-cols-3",
        )}
      >
        {/* Queue list */}
        <div className={cn(activeTab === "published" && "lg:col-span-2")}>
          <ScrollArea className="h-[calc(100vh-300px)]">
            {activeTab === "pending" ? (
              pendingQuery.isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pendingItems.length > 0 ? (
                <div className="space-y-4">
                  <TopicBalance items={pendingItems} />
                  {pendingItems.map(renderPendingCard)}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-8">
                    <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      No studies pending import.
                    </p>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Imports from PubMed/CrossRef land here, scored and ready
                      to review.
                    </p>
                  </CardContent>
                </Card>
              )
            ) : publishedQuery.isLoading ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : publishedQueue.length > 0 ? (
              <div className="space-y-4">
                {publishedQueue.map(renderPublishedCard)}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No published studies match this filter.
                  </p>
                </CardContent>
              </Card>
            )}
          </ScrollArea>
        </div>

        {/* Study preview panel — only shown on Published tab */}
        {activeTab === "published" && (
          <div className="lg:col-span-1">
            {selectedStudy ? (
              <StudyPreviewAssistant study={selectedStudy} />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    Select a study to see detailed preview
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Pagination footer (published only) */}
      {activeTab === "published" && publishedData?.pagination && (
        <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {publishedQueue.length} of{" "}
            {publishedData.pagination.total} studies
          </span>
          {publishedData.pagination.hasMore && (
            <Button variant="outline" size="sm">
              Load More
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartReviewQueue;
