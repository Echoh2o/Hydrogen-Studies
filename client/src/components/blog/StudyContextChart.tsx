/**
 * StudyContextChart — Phase C visual depth.
 *
 * Renders a small "study at a glance" panel + a 5-year research-velocity
 * bar chart for the blog's underlying study category. All numbers come
 * from the studies table — no AI-derived data, no hallucination risk.
 *
 * Hides itself when the underlying data is missing or empty (e.g. a
 * blog whose study has no sample_size, or a category with no recent
 * studies). Result: zero visual cost when there's nothing meaningful
 * to show, real visual weight when there is.
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Users, Clock } from "lucide-react";

interface StudyChartData {
  thisStudy: {
    sampleSize: number | null;
    durationDays: number | null;
  } | null;
  categoryTimeline: Array<{ year: number; count: number }>;
  category: string | null;
}

function formatDuration(days: number): string {
  if (days < 14) return `${days} days`;
  if (days < 90) return `${Math.round(days / 7)} weeks`;
  if (days < 730) return `${Math.round(days / 30)} months`;
  return `${(days / 365).toFixed(1)} years`;
}

export function StudyContextChart({ blogId }: { blogId: number | undefined }) {
  const { data } = useQuery<StudyChartData>({
    queryKey: [`/api/blogs/${blogId}/study-chart-data`],
    enabled: !!blogId,
    staleTime: 60_000,
  });

  if (!data) return null;

  const hasStats =
    data.thisStudy != null &&
    (data.thisStudy.sampleSize != null || data.thisStudy.durationDays != null);
  const hasTimeline =
    data.categoryTimeline && data.categoryTimeline.some((d) => d.count > 0);

  // Nothing meaningful → render nothing. The chart is decorative
  // augmentation, not an essential page element.
  if (!hasStats && !hasTimeline) return null;

  return (
    <Card className="mb-8 bg-gradient-to-br from-teal-50/40 to-sky-50/30 border-teal-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">By the numbers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-3">
          {/* At-a-glance stats — left column on desktop, top on mobile */}
          {hasStats && (
            <div className="space-y-3 md:col-span-1">
              {data.thisStudy?.sampleSize != null && (
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-teal-100 p-2">
                    <Users className="h-4 w-4 text-teal-700" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold tabular-nums">
                      {data.thisStudy.sampleSize.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      participants in this study
                    </div>
                  </div>
                </div>
              )}
              {data.thisStudy?.durationDays != null && data.thisStudy.durationDays > 0 && (
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-sky-100 p-2">
                    <Clock className="h-4 w-4 text-sky-700" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold tabular-nums">
                      {formatDuration(data.thisStudy.durationDays)}
                    </div>
                    <div className="text-xs text-muted-foreground">study duration</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Category research velocity — right side, larger on desktop */}
          {hasTimeline && (
            <div className={hasStats ? "md:col-span-2" : "md:col-span-3"}>
              <div className="text-xs text-muted-foreground mb-2">
                Recent {data.category} research published per year
              </div>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.categoryTimeline} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={28}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(20, 184, 166, 0.08)" }}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 6,
                        border: "1px solid #e2e8f0",
                      }}
                      formatter={(v: number) => [`${v} studies`, "Count"]}
                    />
                    <Bar dataKey="count" fill="#0d9488" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
